import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import AdminProfileModal from '../components/AdminProfileModal';
import './Employees.css';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });
  
  const [deptFilter, setDeptFilter] = useState('All');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('Add'); // 'Add' or 'Edit'
  const [selectedEmp, setSelectedEmp] = useState(null);
  
  // Admin Profile Modal state
  const [selectedEmployeeProfile, setSelectedEmployeeProfile] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDept, setFormDept] = useState('Engineering');
  const [formRole, setFormRole] = useState('Employee');
  const [formError, setFormError] = useState('');

  // Fetch employees on load
  const fetchEmployees = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEmployees(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployees();

    // Auto-refresh when any employee profile is added/updated/deleted
    const employeesSub = supabase
      .channel('public:employees_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        fetchEmployees();
      })
      .subscribe();

    return () => supabase.removeChannel(employeesSub);
  }, []);

  // Update search term if URL changes via global search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('search')) {
      setSearchTerm(params.get('search'));
    }
  }, [location]);

  // Delete Action
  const handleDelete = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to delete this employee?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (!error) {
              setEmployees(employees.filter(emp => emp.id !== id));
              toast.success('Employee deleted');
            } else {
              toast.error('Error deleting employee: ' + error.message);
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  // Open Modal Handler
  const openModal = (type, emp = null) => {
    setModalType(type);
    setFormError('');
    if (type === 'Edit' && emp) {
      setSelectedEmp(emp);
      setFormName(emp.name);
      setFormEmail(emp.email);
      setFormDept(emp.department);
      setFormRole(emp.role);
    } else {
      setSelectedEmp(null);
      setFormName('');
      setFormEmail('');
      setFormDept('Engineering');
      setFormRole('Employee');
    }
    setShowModal(true);
  };

  // View Complete Profile Handler
  const handleViewProfile = async (emp) => {
    setIsFetchingProfile(true);
    const loadingToast = toast.loading('Fetching secure profile data...');
    
    try {
      if (!emp.user_id) {
        setSelectedEmployeeProfile({
          ...emp,
          avatar: `https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`,
          is_active: emp.is_active !== false,
          profileData: {},
          unregistered: true
        });
        toast.dismiss(loadingToast);
        setIsFetchingProfile(false);
        return;
      }
      
      // Call the secure Vite proxy backend instead of Supabase directly
      // This completely bypasses the Supabase Javascript Library blocks
      const response = await fetch(`/api/get-profile?id=${emp.user_id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch secure metadata.');
      }
      
      const user = await response.json();
      const profileData = user.user_metadata?.profile || {};
      
      setSelectedEmployeeProfile({
        ...emp,
        avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`,
        is_active: emp.is_active !== false,
        profileData: profileData
      });
      toast.success('Profile data loaded securely.', { id: loadingToast });
    } catch (err) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsFetchingProfile(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Please enter both name and email.');
      return;
    }

    if (modalType === 'Add') {
      const { data, error } = await supabase
        .from('employees')
        .insert([{
          name: formName,
          email: formEmail,
          department: formDept,
          role: formRole
        }])
        .select();

      if (!error && data) {
        setEmployees([data[0], ...employees]);
        setShowModal(false);
        toast.success('Employee added successfully!');
      } else {
        setFormError(error?.message || 'Failed to add employee');
        toast.error(error?.message || 'Failed to add employee');
      }
    } else {
      const { data, error } = await supabase
        .from('employees')
        .update({
          name: formName,
          email: formEmail,
          department: formDept,
          role: formRole
        })
        .eq('id', selectedEmp.id)
        .select();

      if (!error && data) {
        setEmployees(employees.map(emp => emp.id === selectedEmp.id ? data[0] : emp));
        setShowModal(false);
        toast.success('Employee updated successfully!');
      } else {
        setFormError(error?.message || 'Failed to update employee');
        toast.error(error?.message || 'Failed to update employee');
      }
    }
  };


  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Employees Directory</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage your team members and their roles.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => openModal('Add')}>
          <Plus size={18} /> Add Employee
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search by name or email..."
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-input"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="All">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Design">Design</option>
            <option value="Marketing">Marketing</option>
            <option value="Management">Management</option>
          </select>
        </div>
      </div>

      <div className="card table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading employee directory data...
                </td>
              </tr>
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="employee-row-hover">
                  <td>
                    <div className="employee-cell" onClick={() => handleViewProfile(emp)} style={{ cursor: 'pointer' }} title="Click to view full secure profile">
                      <img src={`https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`} alt={emp.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{emp.department}</td>
                  <td>
                    <span className={`role-badge role-${emp.role.toLowerCase()}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="action-btn" onClick={() => openModal('Edit', emp)}><Edit2 size={16} /></button>
                      <button className="action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(emp.id)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No employees found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-window glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>{modalType} Employee</h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div className="form-group-modal">
                <label>Full Name</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-group-modal">
                <label>Email Address</label>
                <input
                  type="email"
                  className="modal-input"
                  placeholder="e.g. john@rym.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div className="form-group-modal">
                <label>Department</label>
                <input
                  type="text"
                  className="modal-input"
                  list="department-options"
                  placeholder="Select or type a custom department..."
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                />
                <datalist id="department-options">
                  <option value="Engineering" />
                  <option value="Design" />
                  <option value="Marketing" />
                  <option value="Management" />
                  {/* Dynamically include any other custom departments currently in use */}
                  {Array.from(new Set(employees.map(e => e.department)))
                    .filter(d => d && !['Engineering', 'Design', 'Marketing', 'Management'].includes(d))
                    .map(d => (
                      <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div className="form-group-modal">
                <label>System Role</label>
                <select
                  className="modal-input"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  <option value="Employee">Employee</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmployeeProfile && (
        <AdminProfileModal 
          profile={selectedEmployeeProfile}
          onClose={() => setSelectedEmployeeProfile(null)}
        />
      )}
    </div>
  );
};

export default Employees;

