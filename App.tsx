import React, { useEffect, useState, useMemo, useRef } from 'react';
import { AppState, Room, RoomStatus, User, GenerateConfig } from './types';
import { getInitialState, saveState, generateRooms, generateSpecialProject, exportToCSV, importFromCSV } from './services/dataService';
import { RoomCard } from './components/RoomCard';
import { AdminPanel } from './components/AdminPanel';
import { SelectionModal } from './components/SelectionModal';

const ADMIN_PASSWORD = "5658135";
const SYNC_CHANNEL_NAME = 'prime_estate_sync_channel';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(getInitialState);
  const [view, setView] = useState<'GRID' | 'ADMIN'>('GRID');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  
  // Admin Mode: 'SELECT' (normal) or 'LOCK' (management)
  const [adminMode, setAdminMode] = useState<'SELECT' | 'LOCK'>('SELECT');

  // Quick Select State (Dropdowns)
  const [quickBuilding, setQuickBuilding] = useState<string>('');
  const [quickFloor, setQuickFloor] = useState<string>('');
  const [quickRoomId, setQuickRoomId] = useState<string>('');

  // Modal State
  const [modalRoom, setModalRoom] = useState<Room | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Login UI State
  const [loginSearch, setLoginSearch] = useState('');
  const [pendingAdmin, setPendingAdmin] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  // Broadcast Channel for instant sync
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Data Synchronization Logic
  useEffect(() => {
    // 1. Initialize BroadcastChannel
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channelRef.current = channel;

    const syncFromDisk = () => {
      try {
        const latestDiskState = getInitialState();
        setState(prevState => {
          // Deep compare to avoid unnecessary re-renders (Performance Optimization)
          const roomsChanged = JSON.stringify(latestDiskState.rooms) !== JSON.stringify(prevState.rooms);
          const usersChanged = JSON.stringify(latestDiskState.users) !== JSON.stringify(prevState.users);
          
          if (roomsChanged || usersChanged) {
            return {
              ...latestDiskState,
              currentUser: prevState.currentUser // Important: Preserve local session
            };
          }
          return prevState;
        });
      } catch (e) {
        console.error("Sync error", e);
      }
    };

    // 2. Listen to Broadcast Channel (Instant)
    channel.onmessage = (event) => {
      if (event.data === 'UPDATE_DB') {
        syncFromDisk();
      }
    };

    // 3. Listen to Storage Event (Backup for some browsers)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'prime_estate_db_v1') {
        syncFromDisk();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 4. Polling (Safety net for file system delays or non-event updates)
    // Runs every 1 second to ensure eventually consistent data
    const pollInterval = setInterval(syncFromDisk, 1000);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Centralized State Update Wrapper
  const updateGlobalState = (newState: AppState) => {
    setState(newState); // Optimistic UI update
    saveState(newState); // Write to disk
    // Notify other tabs immediately
    if (channelRef.current) {
      channelRef.current.postMessage('UPDATE_DB');
    }
  };

  const handleResetData = () => {
    if(window.confirm("【严重警告】\n此操作将删除所有选房记录和用户数据！\n\n确定要重置系统吗？")) {
      localStorage.removeItem('prime_estate_db_v1');
      if (channelRef.current) channelRef.current.postMessage('UPDATE_DB');
      window.location.reload();
    }
  };

  // Actions
  const handleInitiateLogin = (user: User) => {
      if (user.isAdmin) {
          setPendingAdmin(user);
          setPasswordInput('');
      } else {
          // Update current user locally
          setState(prev => ({ ...prev, currentUser: user }));
      }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === ADMIN_PASSWORD) {
          if (pendingAdmin) {
              setState(prev => ({ ...prev, currentUser: pendingAdmin }));
              setPendingAdmin(null);
          }
      } else {
          alert("管理员密码错误");
          setPasswordInput('');
      }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setView('GRID'); // Reset view on logout
  };

  // Prepare Data for Dropdowns
  const uniqueBuildings = useMemo(() => {
    const b = Array.from(new Set(state.rooms.map(r => r.building)));
    return b.sort((a,b) => {
      const numA = parseInt(String(a));
      const numB = parseInt(String(b));
      if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });
  }, [state.rooms]);

  const availableFloors = useMemo(() => {
    if (!quickBuilding) return [];
    const floors = new Set(state.rooms.filter(r => r.building === quickBuilding).map(r => r.floor));
    return Array.from(floors).sort((a,b) => Number(a) - Number(b));
  }, [state.rooms, quickBuilding]);

  const availableRoomsInDropdown = useMemo(() => {
    if (!quickBuilding || !quickFloor) return [];
    return state.rooms
        .filter(r => r.building === quickBuilding && r.floor === parseInt(quickFloor))
        .sort((a,b) => a.number.localeCompare(b.number));
  }, [state.rooms, quickBuilding, quickFloor]);


  /**
   * Modal Logic
   */
  const handleRoomClick = (room: Room) => {
    if (!state.currentUser) {
        alert("请先登录");
        return;
    }
    // Pre-check status (Optimistic)
    if (room.status !== RoomStatus.AVAILABLE && room.ownerId !== state.currentUser.id && !state.currentUser.isAdmin) {
      if (room.status === RoomStatus.LOCKED) alert("该房源已被锁定");
      else alert("该房源已被选择");
      return;
    }

    setModalRoom(room);
    setIsModalOpen(true);
  };

  const executeSelection = () => {
    if (!modalRoom || !state.currentUser) return;

    // --- TRANSACTION START ---
    // 1. Force read latest state from disk (Critical for concurrency)
    const latestState = getInitialState(); 
    const target = latestState.rooms.find(r => r.id === modalRoom.id);

    if (!target) {
        setIsModalOpen(false);
        alert("数据同步错误，房源不存在");
        return;
    }

    const currentUserId = state.currentUser.id;
    const isUserAdmin = state.currentUser.isAdmin;
    let updatedRooms = [...latestState.rooms];

    // Admin Mode Logic
    if (isUserAdmin && adminMode === 'LOCK') {
         const newStatus = target.status === RoomStatus.LOCKED ? RoomStatus.AVAILABLE : RoomStatus.LOCKED;
         updatedRooms = updatedRooms.map(r => r.id === target.id ? { ...r, status: newStatus, ownerId: null } : r);
    } 
    // User Mode Logic
    else {
        // Deselect logic
        if (target.ownerId === currentUserId) {
             updatedRooms = updatedRooms.map(r => r.id === target.id ? { ...r, status: RoomStatus.AVAILABLE, ownerId: null } : r);
        } 
        // Select logic
        else if (target.status === RoomStatus.AVAILABLE) {
             // 2. Concurrency Check: Is it STILL available?
             if (target.status !== RoomStatus.AVAILABLE) {
                 alert("【手慢了！】该房源刚刚已被其他人抢选。请刷新页面或选择其他房源。");
                 setIsModalOpen(false);
                 // Force sync UI immediately
                 setState(prev => ({ ...prev, rooms: latestState.rooms })); 
                 return;
             }

             // 3. Quota Check
             const mySelections = latestState.rooms.filter(r => r.ownerId === currentUserId);
             if (mySelections.length >= state.currentUser.maxSelections) {
                 alert(`您的名额已满，只能选择 ${state.currentUser.maxSelections} 套房源。`);
                 setIsModalOpen(false);
                 return;
             }
             
             // 4. Commit Change
             updatedRooms = updatedRooms.map(r => r.id === target.id ? { ...r, status: RoomStatus.SELECTED, ownerId: currentUserId } : r);
        } else {
             alert("操作失败：该房源当前状态不可选择。");
             setIsModalOpen(false);
             return;
        }
    }

    // 5. Write to DB
    const nextState = {
        ...latestState,
        currentUser: state.currentUser, // Keep local user
        rooms: updatedRooms
    };
    
    updateGlobalState(nextState);
    setIsModalOpen(false);
    setModalRoom(null);
    // --- TRANSACTION END ---
  };

  /**
   * Quick Select / Dropdown Confirm
   */
  const handleDropdownSubmit = () => {
      if (!quickRoomId) {
          alert("请先选择房源");
          return;
      }
      // Find room in CURRENT state to trigger modal
      const room = state.rooms.find(r => r.id === quickRoomId);
      if (room) {
          handleRoomClick(room);
      } else {
          // Fallback if state is slightly stale, try finding in fresh state? 
          // Usually handleRoomClick handles null, but let's be safe.
          alert("房源信息获取失败，请尝试刷新。");
      }
  };

  const handleRandomSelect = () => {
    const latestState = getInitialState();
    const availableRooms = latestState.rooms.filter(r => r.status === RoomStatus.AVAILABLE);
    
    if (availableRooms.length === 0) {
      alert("很遗憾，当前已无可选房源！");
      return;
    }
    const randomIndex = Math.floor(Math.random() * availableRooms.length);
    const selectedRoom = availableRooms[randomIndex];
    
    setQuickBuilding(selectedRoom.building);
    setQuickFloor(selectedRoom.floor.toString());
    setQuickRoomId(selectedRoom.id);

    const el = document.getElementById(`room-${selectedRoom.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-yellow-400', 'z-50', 'scale-110');
      setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-400', 'z-50', 'scale-110'), 2500);
    }
    
    setTimeout(() => {
        // Need to pass the room object. We can use the one from state to ensure consistency or the one we just found.
        // Better to find it in the current React state to ensure UI object equality if strict mode is on.
        const roomInState = state.rooms.find(r => r.id === selectedRoom.id);
        if (roomInState) handleRoomClick(roomInState);
    }, 500);
  };

  // Admin Actions
  const handleGenerate = (config: GenerateConfig) => {
    const newRooms = generateRooms(config);
    updateGlobalState({ ...state, rooms: newRooms });
    alert(`成功生成 ${newRooms.length} 套房源。`);
  };

  const handleGenerateSpecial = () => {
    const newRooms = generateSpecialProject();
    updateGlobalState({ ...state, rooms: newRooms });
    alert(`成功初始化 4栋 (1-3栋/34F/6户, 4栋/34F/20户)，共 ${newRooms.length} 套。`);
  }

  const handleImport = async (file: File) => {
    try {
      const text = (await file.text()) as string;
      const rooms = importFromCSV(text);
      if(rooms.length > 0) {
        updateGlobalState({ ...state, rooms });
        alert("导入成功！");
      } else {
        alert("CSV 解析失败，无有效数据。");
      }
    } catch (e) {
      alert("文件读取失败");
    }
  };

  const handleAddUser = (name: string, phone: string, maxSelections: number) => {
    const newUser: User = {
      id: `u-${Date.now()}`,
      name,
      phone,
      maxSelections,
      isAdmin: false
    };
    updateGlobalState({ ...state, users: [...state.users, newUser] });
  };

  // Filtered Grid Data
  const filteredRooms = useMemo(() => {
    if (selectedBuilding === 'ALL') return state.rooms;
    return state.rooms.filter(r => r.building === selectedBuilding);
  }, [state.rooms, selectedBuilding]);

  const roomsByFloor = useMemo(() => {
    const groups: {[key: string]: {[key: number]: Room[]}} = {};
    filteredRooms.forEach(room => {
      if (!groups[room.building]) groups[room.building] = {};
      if (!groups[room.building][room.floor]) groups[room.building][room.floor] = [];
      groups[room.building][room.floor].push(room);
    });
    return groups;
  }, [filteredRooms]);

  // Login filtered users
  const filteredUsers = useMemo(() => {
    if (!loginSearch) return state.users;
    return state.users.filter(u => 
      u.name.includes(loginSearch) || 
      u.phone.includes(loginSearch)
    );
  }, [state.users, loginSearch]);


  // --- Render ---

  if (!state.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">在线选房系统</h1>
                <p className="text-slate-500 text-sm mt-1">请选择您的身份登录 (支持 {state.users.length} 位用户)</p>
              </div>
              <input 
                type="text" 
                placeholder="🔍 搜索姓名或电话..." 
                className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
              />
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredUsers.map(user => (
                  <button 
                    key={user.id}
                    onClick={() => handleInitiateLogin(user)}
                    className={`
                        flex flex-col items-start p-3 rounded-lg border text-left transition-all hover:shadow-md
                        ${user.isAdmin 
                            ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 hover:bg-indigo-50'
                        }
                    `}
                  >
                    <div className="flex justify-between w-full items-start">
                        <span className="font-bold text-sm truncate w-full">{user.name}</span>
                        {user.isAdmin && <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.699-3.181A1 1 0 0118 4v2a1 1 0 01-1 1h-1.637l-1.928 3.616A3 3 0 0011 11.53V18a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6.47A3 3 0 005.165 10.61L3.237 7H1.6a1 1 0 01-1-1V4a1 1 0 011-1h1.76l1.699 3.18L9 4.323V3a1 1 0 011-1z" /></svg>}
                    </div>
                    <span className={`text-xs mt-1 ${user.isAdmin ? 'text-slate-300' : 'text-slate-400'}`}>
                      {user.phone || '无电话'}
                    </span>
                    {!user.isAdmin && (
                        <div className="mt-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
                            剩 {user.maxSelections} 次
                        </div>
                    )}
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-400">
                        未找到匹配用户
                    </div>
                )}
             </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
            <span>系统状态: 多窗口实时同步中</span>
          </div>
        </div>

        {/* Admin Password Modal */}
        {pendingAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <form onSubmit={handleAdminLoginSubmit} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">管理员验证</h3>
                    <p className="text-sm text-slate-500 mb-4">请输入管理员密码以登录 <strong>{pendingAdmin.name}</strong> 的账户。</p>
                    <input 
                        type="password" 
                        autoFocus
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="请输入密码"
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setPendingAdmin(null)} className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">取消</button>
                        <button type="submit" className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">确认登录</button>
                    </div>
                </form>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SelectionModal 
        isOpen={isModalOpen}
        room={modalRoom}
        currentUserIds={state.currentUser?.id}
        isAdmin={state.currentUser.isAdmin && adminMode === 'LOCK'}
        onConfirm={executeSelection}
        onCancel={() => setIsModalOpen(false)}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-indigo-600 tracking-tight hidden sm:block">选房系统</h1>
            <nav className="flex space-x-2">
              <button 
                onClick={() => setView('GRID')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'GRID' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'}`}
              >
                选房大厅
              </button>
              {state.currentUser.isAdmin && (
                <button 
                  onClick={() => setView('ADMIN')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'ADMIN' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  后台管理
                </button>
              )}
            </nav>
          </div>
          
          {/* Admin Mode Toggle */}
          {state.currentUser.isAdmin && view === 'GRID' && (
             <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setAdminMode('SELECT')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${adminMode === 'SELECT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  选房模式
                </button>
                <button 
                  onClick={() => setAdminMode('LOCK')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${adminMode === 'LOCK' ? 'bg-red-500 shadow text-white' : 'text-slate-500 hover:text-red-500'}`}
                >
                  锁定管理
                </button>
             </div>
          )}

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-700">{state.currentUser.name}</div>
              <div className="text-xs text-slate-400">
                {state.currentUser.isAdmin ? '管理员' : `已选: ${state.rooms.filter(r => r.ownerId === state.currentUser?.id).length} / ${state.currentUser.maxSelections}`}
              </div>
            </div>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col md:flex-row gap-6">
        
        {view === 'ADMIN' && state.currentUser.isAdmin ? (
          <div className="w-full">
            <AdminPanel 
              onGenerate={handleGenerate}
              onGenerateSpecial={handleGenerateSpecial}
              onExport={() => exportToCSV(state.rooms)}
              onImport={(f) => handleImport(f)}
              onAddUser={handleAddUser}
              onResetData={handleResetData}
              users={state.users}
            />
          </div>
        ) : (
          <>
            {/* Sidebar: Filters & Quick Select */}
            <div className="w-full md:w-64 space-y-6 shrink-0">
               {/* Dropdown / Quick Select Panel */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-24 z-20">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center">
                   <span className="bg-indigo-600 text-white p-1 rounded mr-2">
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </span>
                   下拉选房 (列表)
                </h3>
                <div className="space-y-3 text-sm">
                   <div>
                     <label className="text-slate-500 text-xs block mb-1">选择楼栋</label>
                     <select 
                       value={quickBuilding} 
                       onChange={e => {
                           setQuickBuilding(e.target.value);
                           setQuickFloor('');
                           setQuickRoomId('');
                       }} 
                       className="w-full border rounded p-2 bg-slate-50"
                     >
                        <option value="">-- 请选择 --</option>
                        {uniqueBuildings.map(b => (
                            <option key={b} value={b}>{b} 栋</option>
                        ))}
                     </select>
                   </div>
                   <div>
                     <label className="text-slate-500 text-xs block mb-1">选择楼层</label>
                     <select 
                       value={quickFloor} 
                       onChange={e => {
                           setQuickFloor(e.target.value);
                           setQuickRoomId('');
                       }} 
                       disabled={!quickBuilding}
                       className="w-full border rounded p-2 bg-slate-50 disabled:opacity-50"
                     >
                        <option value="">-- 请选择 --</option>
                        {availableFloors.map(f => (
                            <option key={f} value={f}>{f} 层</option>
                        ))}
                     </select>
                   </div>
                   <div>
                     <label className="text-slate-500 text-xs block mb-1">选择房号 (仅显示可选)</label>
                     <select 
                       value={quickRoomId} 
                       onChange={e => setQuickRoomId(e.target.value)} 
                       disabled={!quickFloor}
                       className="w-full border rounded p-2 bg-slate-50 disabled:opacity-50"
                     >
                        <option value="">-- 请选择 --</option>
                        {availableRoomsInDropdown.map(r => (
                            <option key={r.id} value={r.id} disabled={r.status !== RoomStatus.AVAILABLE}>
                                {r.number} - {r.area}m² {r.status !== RoomStatus.AVAILABLE ? `(${r.status === RoomStatus.LOCKED ? '锁定' : '已选'})` : ''}
                            </option>
                        ))}
                     </select>
                   </div>
                   <button 
                    onClick={handleDropdownSubmit}
                    disabled={!quickRoomId}
                    className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                   >
                     确认选房
                   </button>
                   
                   {/* Random Button */}
                   <div className="pt-2">
                     <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-2 text-slate-300 text-xs">或者</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                     </div>
                     <button
                        onClick={handleRandomSelect}
                        className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        随机选房
                     </button>
                   </div>
                </div>
               </div>

               {/* Legend & Filter */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-[500px]">
                  <h3 className="font-bold text-slate-800 mb-3">可视化筛选</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <button 
                      onClick={() => setSelectedBuilding('ALL')}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${selectedBuilding === 'ALL' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      全部楼栋
                    </button>
                    {uniqueBuildings.map(b => (
                      <button 
                        key={b}
                        onClick={() => setSelectedBuilding(b)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${selectedBuilding === b ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {b} 栋
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                     <div className="flex items-center text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-white border border-slate-300 mr-2"></span> 可选房源</div>
                     <div className="flex items-center text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> 他人已选/售出</div>
                     <div className="flex items-center text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span> 您已选择</div>
                     <div className="flex items-center text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 mr-2"></span> 系统锁定/销控</div>
                  </div>
               </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 space-y-6">
              {/* Admin Banner */}
              {state.currentUser.isAdmin && adminMode === 'LOCK' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center sticky top-20 z-20 shadow-sm">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <strong>锁定管理模式已开启</strong>：点击房间可直接 锁定 或 解锁。被锁定的房间普通用户无法选择。
                </div>
              )}

              {/* Grid Visualization */}
              {Object.keys(roomsByFloor).length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
                   <p className="text-slate-400">暂无房源数据。请联系管理员在后台生成房源。</p>
                 </div>
              ) : (
                <div className="space-y-12">
                  {Object.keys(roomsByFloor).sort((a,b) => {
                      const numA = parseInt(a);
                      const numB = parseInt(b);
                      if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.localeCompare(b);
                  }).map(building => (
                    <div key={building} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center sticky left-0 z-10">
                        <h2 className="text-lg font-bold text-slate-700">{building} 栋</h2>
                        <span className="text-xs font-mono text-slate-400">共 {Object.keys(roomsByFloor[building]).length} 层</span>
                      </div>
                      <div className="p-6 overflow-x-auto">
                        <div className="flex flex-col-reverse space-y-4 space-y-reverse min-w-fit">
                          {Object.keys(roomsByFloor[building])
                            .map(Number)
                            .sort((a, b) => a - b)
                            .map(floor => (
                              <div key={floor} className="flex items-center space-x-6">
                                <div className="w-8 text-xs font-bold text-slate-400 text-right shrink-0">
                                  {floor}层
                                </div>
                                <div 
                                  className="flex-1 grid gap-1.5"
                                  style={{
                                    gridTemplateColumns: `repeat(${roomsByFloor[building][floor].length}, minmax(40px, 1fr))`
                                  }}
                                >
                                  {roomsByFloor[building][floor]
                                    .sort((a,b) => a.number.localeCompare(b.number))
                                    .map(room => (
                                      <RoomCard 
                                        key={room.id} 
                                        room={room} 
                                        onClick={handleRoomClick}
                                        isSelectedByCurrentUser={room.ownerId === state.currentUser?.id}
                                      />
                                    ))
                                  }
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;