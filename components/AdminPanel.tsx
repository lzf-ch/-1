import React, { useState } from 'react';
import { GenerateConfig, User } from '../types';

interface AdminPanelProps {
  onGenerate: (config: GenerateConfig) => void;
  onGenerateSpecial: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onAddUser: (name: string, phone: string, count: number) => void;
  onExportUsers: () => void;
  onImportUsers: (file: File) => void;
  onResetData: () => void;
  users: User[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onGenerate, 
  onGenerateSpecial, 
  onExport, 
  onImport, 
  onAddUser, 
  onExportUsers,
  onImportUsers,
  onResetData, 
  users 
}) => {
  const [config, setConfig] = useState<GenerateConfig>({
    buildingCount: 3,
    floorsPerBuilding: 10,
    roomsPerFloor: 4,
    baseArea: 90,
    buildingPrefix: 'A'
  });

  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserLimit, setNewUserLimit] = useState(1);

  const handleDataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  const handleUserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportUsers(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-8">
      
      {/* Generator Section */}
      <section>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          房源生成
        </h3>
        
        <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="font-bold text-indigo-900 text-lg mb-2">一键初始化: 标准项目演示</h4>
            <p className="text-sm text-indigo-700 mb-4 max-w-2xl">
              按照系统预设规则生成 4 栋楼：<br/>
              • <strong>1-3栋</strong>: 34层 / 每层6户 (01-06)<br/>
              • <strong>4栋</strong>: 34层 / 每层20户 (01-20)<br/>
            </p>
            <button 
              onClick={() => {
                if(confirm("确定重置为特定项目结构？当前所有数据将被清空。")) {
                  onGenerateSpecial();
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3 px-6 rounded shadow-md transition-colors w-full md:w-auto"
            >
              立即生成 (4栋混合户型)
            </button>
          </div>
          {/* Decorative background icon */}
          <div className="absolute -right-6 -bottom-6 text-indigo-100 opacity-50">
             <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
          </div>
        </div>
      </section>

      <div className="border-t border-slate-100"></div>

      {/* Data Management */}
      <section>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          数据管理 (房源库)
        </h3>
        <div className="flex flex-wrap gap-4 items-center">
          <button 
            onClick={onExport}
            className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            导出完整数据 (CSV)
          </button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleDataFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 px-4 rounded transition-colors">
              导入完整数据 (CSV)
            </button>
          </div>

          <div className="flex-1 text-right">
             <button 
               onClick={onResetData}
               className="text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded text-sm font-medium border border-red-200 transition-colors"
             >
               ⚠️ 重置系统数据
             </button>
          </div>
        </div>
      </section>

      <div className="border-t border-slate-100"></div>

      {/* User Management */}
      <section>
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-bold text-slate-800">用户管理</h3>
           <div className="flex gap-2">
             <button 
                onClick={onExportUsers}
                className="text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded text-xs font-medium transition-colors"
             >
                ⬇️ 导出客户名单
             </button>
             <div className="relative">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleUserFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded text-xs font-medium transition-colors">
                    ⬆️ 批量导入客户
                </button>
             </div>
           </div>
        </div>

        <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <input 
            type="text" 
            placeholder="客户姓名"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
           <input 
            type="text" 
            placeholder="电话号码"
            value={newUserPhone}
            onChange={(e) => setNewUserPhone(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <div className="flex items-center">
            <span className="text-xs text-slate-500 mr-2 whitespace-nowrap">限选次数:</span>
            <input 
              type="number" 
              placeholder="1"
              value={newUserLimit}
              onChange={(e) => setNewUserLimit(parseInt(e.target.value))}
              className="w-16 border rounded px-3 py-2 text-sm"
            />
          </div>
          <button 
            onClick={() => {
              if (newUserName) {
                onAddUser(newUserName, newUserPhone, newUserLimit);
                setNewUserName('');
                setNewUserPhone('');
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded text-sm font-medium"
          >
            添加客户
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-slate-500 font-medium border-b">姓名</th>
                <th className="px-4 py-2 text-left text-slate-500 font-medium border-b">电话</th>
                <th className="px-4 py-2 text-left text-slate-500 font-medium border-b">限额</th>
                <th className="px-4 py-2 text-left text-slate-500 font-medium border-b">系统ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{u.name} {u.isAdmin && <span className="text-xs bg-slate-200 px-1 rounded ml-1">管理员</span>}</td>
                  <td className="px-4 py-2 text-slate-600">{u.phone || '-'}</td>
                  <td className="px-4 py-2 text-slate-600">{u.maxSelections}</td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{u.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};