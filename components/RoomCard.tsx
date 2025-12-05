import React from 'react';
import { Room, RoomStatus } from '../types';

interface RoomCardProps {
  room: Room;
  onClick: (room: Room) => void;
  isSelectedByCurrentUser: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onClick, isSelectedByCurrentUser }) => {
  const getStatusStyles = () => {
    if (room.status === RoomStatus.LOCKED) {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 ring-1 ring-inset ring-gray-200 shadow-inner';
    }
    if (room.status === RoomStatus.SELECTED) {
      if (isSelectedByCurrentUser) {
        return 'bg-green-600 text-white shadow-lg shadow-green-200 border-green-700 transform scale-105 ring-2 ring-green-400 z-10 cursor-pointer';
      }
      return 'bg-red-500 text-white cursor-not-allowed border-red-600 opacity-90 shadow-sm';
    }
    // Available
    return 'bg-white text-slate-700 hover:bg-green-50 hover:border-green-400 cursor-pointer border-slate-200 hover:shadow-md hover:-translate-y-0.5';
  };

  const getStatusLabel = () => {
    if (room.status === RoomStatus.SELECTED) {
      return isSelectedByCurrentUser ? '我已选' : '已售';
    }
    if (room.status === RoomStatus.LOCKED) {
      return '锁定';
    }
    return '可选';
  };

  return (
    <div 
      id={`room-${room.id}`}
      onClick={() => onClick(room)}
      className={`
        relative p-1 rounded border transition-all duration-200 flex flex-col justify-between h-10 text-[10px] select-none pointer-events-auto overflow-hidden
        ${getStatusStyles()}
        ${room.status === RoomStatus.LOCKED ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0wIDBMNCA0Wk00IDBMMCA0WiIgc3Ryb2tlPSIjZTVlN2ViIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+")]' : ''}
      `}
    >
      <div className="flex justify-between items-start w-full leading-none">
        <span className="font-bold text-xs scale-90 origin-top-left">{room.number.slice(-2)}</span>
        <span className="text-[8px] font-mono opacity-70 transform scale-75 origin-top-right whitespace-nowrap">{room.area}</span>
      </div>
      
      <div className="mt-auto flex justify-between items-end w-full">
        <span className="text-[8px] font-semibold tracking-wider uppercase opacity-90 transform scale-90 origin-bottom-left whitespace-nowrap">
          {getStatusLabel()}
        </span>
      </div>

      {/* Owner Badge */}
      {room.ownerId && !isSelectedByCurrentUser && (
        <div className="absolute top-1 right-1 bg-white/20 backdrop-blur-sm rounded-full w-1.5 h-1.5"></div>
      )}
      {room.status === RoomStatus.LOCKED && (
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
         </div>
      )}
    </div>
  );
};