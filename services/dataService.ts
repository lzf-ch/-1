import { Room, RoomStatus, User, GenerateConfig, AppState } from "../types";

const STORAGE_KEY = 'prime_estate_db_v1';

// Declare XLSX global from CDN
declare const XLSX: any;

// Initial Mock Data
const INITIAL_ADMIN: User = { id: 'admin', name: '系统管理员', phone: '13800000000', maxSelections: 999, isAdmin: true };
const INITIAL_USER: User = { id: 'user1', name: '张三', phone: '13912345678', maxSelections: 1, isAdmin: false };

export const getInitialState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Basic validation to ensure data integrity
      if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("State load error (data corruption likely). Resetting to default.", e);
  }
  
  const defaultRooms = generateSpecialProject();

  return {
    rooms: defaultRooms,
    users: [INITIAL_ADMIN, INITIAL_USER],
    currentUser: null,
  };
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('local-storage-update'));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

// --- Logic Helpers ---

// Generic Generator
export const generateRooms = (config: GenerateConfig): Room[] => {
  const rooms: Room[] = [];
  const floors = Array.from({ length: config.floorsPerBuilding }, (_, i) => i + 1);
  const units = Array.from({ length: config.roomsPerFloor }, (_, i) => i + 1);
  const buildings = Array.from({ length: config.buildingCount }, (_, i) => i + 1);

  buildings.forEach(bId => {
    floors.forEach(floor => {
      units.forEach(unit => {
        const areaVariance = (unit % 2 === 0 ? 5 : -5) + (floor * 0.5); 
        const roomNumber = `${floor}${unit.toString().padStart(2, '0')}`;
        
        rooms.push({
          id: `${config.buildingPrefix}${bId}-${floor}-${unit.toString().padStart(2, '0')}`,
          building: `${config.buildingPrefix}${bId}`,
          floor: floor,
          number: roomNumber,
          area: Math.round((config.baseArea + areaVariance) * 100) / 100,
          status: RoomStatus.AVAILABLE,
          ownerId: null
        });
      });
    });
  });
  return rooms;
};

// Specific Generator for the User Requirement
export const generateSpecialProject = (): Room[] => {
  const rooms: Room[] = [];
  const floors = Array.from({ length: 34 }, (_, i) => i + 1); // 34 Floors

  // Buildings 1, 2, 3
  [1, 2, 3].forEach(bId => {
    floors.forEach(floor => {
      // 6 units
      for (let unit = 1; unit <= 6; unit++) {
        const roomNumber = `${floor}${unit.toString().padStart(2, '0')}`;
        rooms.push({
          id: `${bId}-${floor}-${unit.toString().padStart(2, '0')}`,
          building: `${bId}`,
          floor: floor,
          number: roomNumber,
          area: Math.round((90 + (unit * 2)) * 100) / 100, // Randomish area
          status: RoomStatus.AVAILABLE,
          ownerId: null
        });
      }
    });
  });

  // Building 4
  floors.forEach(floor => {
    // 20 units
    for (let unit = 1; unit <= 20; unit++) {
      const roomNumber = `${floor}${unit.toString().padStart(2, '0')}`;
      rooms.push({
        id: `4-${floor}-${unit.toString().padStart(2, '0')}`,
        building: `4`,
        floor: floor,
        number: roomNumber,
        area: Math.round((50 + (unit * 1.5)) * 100) / 100, // Slightly smaller base area for high density
        status: RoomStatus.AVAILABLE,
        ownerId: null
      });
    }
  });

  return rooms;
};

// --- Room Data Import/Export (Still CSV for now as per request only for Users) ---

export const exportToCSV = (rooms: Room[], users: User[]) => {
  // Create a lookup map for users
  const userMap = new Map(users.map(u => [u.id, u]));

  const headers = ['ID', '楼栋', '楼层', '房号', '面积', '状态', '拥有者ID', '拥有者姓名', '拥有者电话'];
  const rows = rooms.map(r => {
    const owner = r.ownerId ? userMap.get(r.ownerId) : null;
    return [
      r.id, 
      r.building, 
      r.floor, 
      r.number, 
      r.area, 
      r.status, 
      r.ownerId || '',
      owner ? owner.name : '',
      owner ? owner.phone : ''
    ].join(',');
  });
  
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n'); // Add BOM
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `房源数据_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importFromCSV = (csvText: string): { rooms: Room[], importedUsers: User[] } => {
  const lines = csvText.split('\n');
  const rooms: Room[] = [];
  const importedUsers: Map<string, User> = new Map();
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(',');
    if (cols.length < 5) continue;

    const id = cols[0];
    const building = cols[1];
    const floor = parseInt(cols[2]);
    const number = cols[3];
    const area = parseFloat(cols[4]);
    const status = cols[5] as RoomStatus;
    const ownerId = cols[6] || null;
    const ownerName = cols[7] || '';
    const ownerPhone = cols[8] || '';

    rooms.push({
      id, building, floor, number, area, status, ownerId
    });

    if (ownerId && ownerName && !importedUsers.has(ownerId)) {
        importedUsers.set(ownerId, {
            id: ownerId,
            name: ownerName,
            phone: ownerPhone,
            maxSelections: 1, 
            isAdmin: false
        });
    }
  }
  return { rooms, importedUsers: Array.from(importedUsers.values()) };
};

// --- User Data Excel Import/Export ---

export const exportUsersToExcel = (users: User[]) => {
  const data = users.map(u => ({
    '客户姓名': u.name,
    '电话号码': u.phone,
    '限购数量': u.maxSelections,
    '是否管理员': u.isAdmin ? 'TRUE' : 'FALSE',
    '系统ID': u.id
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "客户名单");

  // Write file
  XLSX.writeFile(workbook, `客户名单_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const importUsersFromExcel = (buffer: ArrayBuffer): User[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  const users: User[] = [];
  
  jsonData.forEach((row: any) => {
    // Try to map fields based on Chinese headers
    const name = row['客户姓名'] || row['姓名'];
    const phone = row['电话号码'] || row['电话'];
    
    // Valid data check
    if (!name || !phone) return;

    const maxSelections = parseInt(row['限购数量'] || row['限额']) || 1;
    const isAdmin = String(row['是否管理员'] || '').toUpperCase() === 'TRUE';
    const id = row['系统ID'] || `u-${Date.now()}-${Math.floor(Math.random()*10000)}`;

    users.push({
      id: String(id),
      name: String(name).trim(),
      phone: String(phone).trim(),
      maxSelections,
      isAdmin
    });
  });

  return users;
};