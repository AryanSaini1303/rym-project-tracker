import React from 'react';
import ReactDOM from 'react-dom';
import { X, MapPin } from 'lucide-react';

const AdminProfileModal = ({ profile, onClose }) => {
  const profileData = profile.profileData || {};

  const renderField = (label, name) => {
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 500, color: profileData[name] ? '#fff' : 'rgba(255,255,255,0.3)', minHeight: '1.4rem' }}>
          {profileData[name] || '—'}
        </div>
      </div>
    );
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 9999, alignItems: 'flex-start', overflowY: 'auto', padding: '3rem 1rem' }}>
      <div className="modal-content glass" onMouseDown={(e) => e.stopPropagation()} style={{ margin: 'auto', display: 'flex', flexDirection: 'column', maxWidth: '750px', width: '100%', padding: '0', backgroundColor: '#13161c', position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
        
        {/* Header Section */}
        <div style={{ backgroundColor: 'rgba(19, 22, 28, 0.98)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <img src={profile.avatar} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#e28743', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                Employee Profile Data
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 700 }}>{profile.name}</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', background: profile.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: profile.is_active ? '#10b981' : '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 600 }}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Role: <span style={{ color: '#fff' }}>{profile.role}</span> <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.2)' }}>|</span> Department: <span style={{ color: '#fff' }}>{profile.department}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button type="button" className="modal-close-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Section */}
        <div style={{ padding: '2rem' }}>
          
          {profile.unregistered && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', padding: '1rem', borderRadius: '4px', marginBottom: '2rem', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--warning)', display: 'block', marginBottom: '0.25rem' }}>Account Not Registered Yet</strong>
              This employee was added to the directory by an Admin, but they have not yet logged into the Employee Panel to complete their registration. Advanced profile data (like Bank Details and Emergency Contacts) will remain empty until they do so.
            </div>
          )}

          {/* Base Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
            {renderField('Gender', 'gender')}
            {renderField('Marital Status', 'marital_status')}
            
            {renderField('Date of Birth', 'dob')}
            {renderField('Date of Joining', 'doj')}
            
            {renderField('Aadhaar Card', 'aadhaar_card')}
            {renderField('Blood Group', 'blood_group')}
            
            {renderField('Insurance', 'insurance')}
            {renderField('Phone', 'phone')}
            
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Email</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#fff' }}>{profile.email || '—'}</div>
            </div>
            {renderField('Emergency Contact', 'emergency_contact')}
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '1.5rem 0' }}></div>

          {/* Bank Details */}
          <div style={{ marginBottom: '1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#e28743', fontWeight: 700, letterSpacing: '0.05em' }}>
            Bank Account Details
          </div>
          
          <div style={{ marginBottom: '1.2rem' }}>
            {renderField('Account Holder Name', 'account_holder_name')}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
            {renderField('Bank Name', 'bank_name')}
            {renderField('Account Number', 'account_number')}
            
            {renderField('IFSC Code', 'ifsc_code')}
            {renderField('Branch', 'branch')}
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '1.5rem 0' }}></div>

          {/* Address Details */}
          {renderField('Current Address', 'current_address')}
          {renderField('Permanent Address', 'permanent_address')}

        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminProfileModal;
