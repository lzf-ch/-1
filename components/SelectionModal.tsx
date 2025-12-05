import React from 'react';
import { Room, RoomStatus } from '../types';

interface SelectionModalProps {
  isOpen: boolean;
  room: Room | null;
  currentUserIds: string | undefined;
  isAdmin: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({ 
  isOpen, 
  room, 
  currentUserIds, 
  isAdmin, 
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen || !room) return null;

  const isMyRoom = room.ownerId === currentUserIds;
  const isSelected = room.status === RoomStatus.SELECTED;
  const isLocked = room.status === RoomStatus.LOCKED;

  let title = "确认选房";
  let description = "请核对房源信息，确认无误后点击确定。";
  let confirmText = "确认选择";
  let confirmColor = "bg-indigo-600 hover:bg-indigo-700";

  if (isAdmin) {
      if (isSelected && !isMyRoom) {
          title = "管理员操作";
          description = "该房源已被他人选择。您确定要强制操作吗？";
          confirmText = "强制锁定";
          confirmColor = "bg-red-600 hover:bg-red-700";
      } else if (isLocked) {
          title = "解锁房源";
          description = "确定要解锁该房源，使其变为可选状态吗？";
          confirmText = "解锁";
          confirmColor = "bg-green-600 hover:bg-green-700";
      } else {
          title = "锁定房源";
          description = "锁定后用户将无法选择该房源。";
          confirmText = "锁定";
          confirmColor = "bg-red-600 hover:bg-red-700";
      }
  } else {
      if (isMyRoom) {
          title = "退选房源";
          description = "取消选择后，该房源将立即释放给其他人。确定要退选吗？";
          confirmText = "确认退选";
          confirmColor = "bg-red-500 hover:bg-red-600";
      } else if (isSelected || isLocked) {
           return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">无法选择</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            {isLocked ? "该房源已被系统锁定。" : "该房源已被其他人选择。"}
                        </p>
                        <div className="mt-5">
                            <button onClick={onCancel} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-100 text-base font-medium text-gray-700 hover:bg-gray-200 focus:outline-none sm:text-sm">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </div>
           );
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">楼栋:</span> <span className="font-bold text-slate-800">{room.building}栋</span></div>
                    <div><span className="text-slate-500">楼层:</span> <span className="font-bold text-slate-800">{room.floor}层</span></div>
                    <div><span className="text-slate-500">房号:</span> <span className="font-bold text-slate-800">{room.number}</span></div>
                    <div><span className="text-slate-500">面积:</span> <span className="font-bold text-slate-800">{room.area} m²</span></div>
                </div>
            </div>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3">
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:text-sm transition-colors ${confirmColor}`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};