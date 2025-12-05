import React, { useEffect, useState, useMemo } from 'react';
import { AppState, Room, RoomStatus, User, GenerateConfig } from './types';
import { getInitialState, saveState, generateRooms, generateSpecialProject, exportToCSV, importFromCSV } from './services/dataService';
import { RoomCard } from './components/RoomCard';
import { AdminPanel } from './components/AdminPanel';
import { SelectionModal } from './components/SelectionModal';

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

  // Sync with LocalStorage for Multi-tab simulation
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'prime_estate_db_v1' && e.newValue) {
        try {
          const remoteState = JSON.parse(e.newValue);
          setState(prev => ({
            ...remoteState,
            currentUser: prev.currentUser 
          }));
        } catch (err) {
          console.error("Data sync error:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Persist on change
  const updateState = (newState: AppState) => {
    setState(newState);
    saveState(newState);
  };

  const handleResetData = () => {
    if(window.confirm("确定要重置所有数据吗？这将清除所有选房记录和用户数据，恢复到初始状态。")) {
      localStorage.removeItem('prime_estate_db_v1');
      window.location.reload();
    }
  };

  // Actions
  const handleLogin = (userId: string) => {
    const user = state.users.find(u => u.id === userId);
    if (user) {
      updateState({ ...state, currentUser: user });
    }
  };

  const handleLogout = () => {
    updateState({ ...state, currentUser: null });
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
    // Fix: Explicitly cast to Number to avoid arithmetic on unknown types or strings
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
    setModalRoom(room);
    setIsModalOpen(true);
  };

  const executeSelection = () => {
    if (!modalRoom || !state.currentUser) return;

    // Refresh room data to ensure status is current
    const target = state.rooms.find(r => r.id === modalRoom.id);
    if (!target) {
        setIsModalOpen(false);
        return;
    }

    const currentUserId = state.currentUser.id;
    const isUserAdmin = state.currentUser.isAdmin;
    let updatedRooms = [...state.rooms];

    // Admin Mode Logic
    if (isUserAdmin && adminMode === 'LOCK') {
         const newStatus = target.status === RoomStatus.LOCKED ? RoomStatus.AVAILABLE : RoomStatus.LOCKED;
         // If unlocking, or locking (clearing owner)
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
             // Limit check
             const mySelections = state.rooms.filter(r => r.ownerId === currentUserId);
             if (mySelections.length >= state.currentUser.maxSelections) {
                 alert(`您只能选择 ${state.currentUser.maxSelections} 套房源。`);
                 setIsModalOpen(false);
                 return;
             }
             updatedRooms = updatedRooms.map(r => r.id === target.id ? { ...r, status: RoomStatus.SELECTED, ownerId: currentUserId } : r);
        } else {
             // Should be handled by modal display but double check
             alert("该房源不可选择");
             setIsModalOpen(false);
             return;
        }
    }

    updateState({ ...state, rooms: updatedRooms });
    setIsModalOpen(false);
    setModalRoom(null);
  };

  /**
   * Quick Select / Dropdown Confirm
   */
  const handleDropdownSubmit = () => {
      if (!quickRoomId) {
          alert("请先选择房源");
          return;
      }
      const room = state.rooms.find(r => r.id === quickRoomId);
      if (room) {
          handleRoomClick(room);
      }
  };

  const handleRandomSelect = () => {
    const availableRooms = state.rooms.filter(r => r.status === RoomStatus.AVAILABLE);
    if (availableRooms.length === 0) {
      alert("很遗憾，当前已无可选房源！");
      return;
    }
    const randomIndex = Math.floor(Math.random() * availableRooms.length);
    const selectedRoom = availableRooms[randomIndex];
    
    // Auto populate dropdowns (optional UX)
    setQuickBuilding(selectedRoom.building);
    setQuickFloor(selectedRoom.floor.toString());
    setQuickRoomId(selectedRoom.id);

    // Scroll and Show Modal
    const el = document.getElementById(`room-${selectedRoom.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-yellow-400', 'z-50', 'scale-110');
      setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-400', 'z-50', 'scale-110'), 2500);
    }
    
    setTimeout(() => {
        handleRoomClick(selectedRoom);
    }, 500);
  };

  // Admin Actions
  const handleGenerate = (config: GenerateConfig) => {
    const newRooms = generateRooms(config);
    updateState({ ...state, rooms: newRooms });
    alert(`成功生成 ${newRooms.length} 套房源。`);
  };

  const handleGenerateSpecial = () => {
    const newRooms = generateSpecialProject();
    updateState({ ...state, rooms: newRooms });
    alert(`成功初始化 4栋 (1-3栋/34F/6户, 4栋/34F/20户)，共 ${newRooms.length} 套。`);
  }

  const handleImport = async (file: File) => {
    try {
      const text = (await file.text()) as string;
      const rooms = importFromCSV(text);
      if(rooms.length > 0) {
        updateState({ ...state, rooms });
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
    updateState({ ...state, users: [...state.users, newUser] });
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


  // --- Render ---

  if (!state.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">在线选房系统</h1>
          <p className="text-slate-500 mb-8">支持多电脑同时访问 (数据即时同步)</p>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {state.users.map(user => (
              <button 
                key={user.id}
                onClick={() => handleLogin(user.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-slate-700 group-hover:text-indigo-700">{user.name}</span>
                  <span className="text-xs text-slate-400">
                    {user.isAdmin ? '管理员' : `客户 ${user.phone ? `(${user.phone})` : ''} - 剩余 ${user.maxSelections} 次`}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-200 group-hover:text-indigo-600">
                  →
                </div>
              </button>
            ))}
          </div>
          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
            <button onClick={handleResetData} className="text-xs text-red-400 hover:text-red-600 underline">
              数据异常？点击重置系统
            </button>
          </div>
        </div>
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