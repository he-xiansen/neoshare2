import React, { useEffect, useState } from 'react';
import { client } from '../api/client';
import { Loader2, Trash2, UserPlus } from 'lucide-react';

interface User {
    id: number;
    username: string;
    role: string;
    created_at: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

  const fetchUsers = async () => {
    try {
      const res = await client.get('/users/');
      setUsers(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确认执行此操作？')) return;
    try {
      await client.delete(`/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      alert('删除用户失败');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await client.post('/users/', newUser);
          setShowCreate(false);
          setNewUser({ username: '', password: '', role: 'user' });
          fetchUsers();
      } catch (error) {
          alert('创建用户失败');
      }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">用户管理</h1>
        <button 
            onClick={() => setShowCreate(!showCreate)}
            className="bg-primary hover:bg-fuchsia-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
            <UserPlus className="w-4 h-4" />
            <span>创建用户</span>
        </button>
      </div>

      {showCreate && (
          <div className="bg-zinc-900 p-6 rounded-lg mb-8 border border-zinc-700">
              <h3 className="text-white font-semibold mb-4">新用户</h3>
              <form onSubmit={handleCreate} className="flex gap-4 items-end">
                  <div>
                      <label className="block text-xs text-zinc-500 mb-1">用户名</label>
                      <input 
                        type="text" 
                        required
                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-xs text-zinc-500 mb-1">密码</label>
                      <input 
                        type="password" 
                        required
                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-xs text-zinc-500 mb-1">角色</label>
                      <select 
                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                      >
                          <option value="user">普通用户</option>
                          <option value="admin">管理员</option>
                      </select>
                  </div>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                      创建
                  </button>
              </form>
          </div>
      )}

      <div className="bg-secondary border border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 text-zinc-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">用户名</th>
              <th className="px-6 py-4">角色</th>
              <th className="px-6 py-4">创建时间</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-700">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 text-zinc-500">{user.id}</td>
                <td className="px-6 py-4 text-white font-medium">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-zinc-700 text-zinc-300'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500 text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
