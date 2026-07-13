import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Edit2, Save, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

const CompleteProfileModal = ({ profile, onClose, onProfileUpdated }) => {
  const requiredFields = ['gender', 'marital_status', 'dob', 'doj', 'aadhaar_card', 'blood_group', 'insurance', 'phone', 'emergency_contact', 'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 'branch', 'current_address', 'permanent_address'];
  const filledFields = requiredFields.filter(f => profile.profileData && profile.profileData[f] && profile.profileData[f].trim() !== '').length;
  const isComplete = filledFields === requiredFields.length;

  const [isEditing, setIsEditing] = useState(!isComplete);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    gender: profile.profileData?.gender || '',
    marital_status: profile.profileData?.marital_status || '',
    dob: profile.profileData?.dob || '',
    doj: profile.profileData?.doj || '',
    aadhaar_card: profile.profileData?.aadhaar_card || '',
    blood_group: profile.profileData?.blood_group || '',
    insurance: profile.profileData?.insurance || '',
    phone: profile.profileData?.phone || '',
    emergency_contact: profile.profileData?.emergency_contact || '',
    account_holder_name: profile.profileData?.account_holder_name || '',
    bank_name: profile.profileData?.bank_name || '',
    account_number: profile.profileData?.account_number || '',
    ifsc_code: profile.profileData?.ifsc_code || '',
    branch: profile.profileData?.branch || '',
    current_address: profile.profileData?.current_address || '',
    permanent_address: profile.profileData?.permanent_address || '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (formData.phone && !/^\d{10}$/.test(String(formData.phone).trim())) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { profile: formData }
      });

      if (error) throw error;
      
      toast.success("Profile updated successfully!");
      onProfileUpdated(formData);
      setIsEditing(false);
    } catch (err) {
      toast.error("Error saving profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (label, name, type = 'text') => {
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
          {label}
        </div>
        {isEditing ? (
          <input 
            type={name === 'phone' ? 'tel' : type}
            name={name}
            maxLength={name === 'phone' ? '10' : undefined}
            value={formData[name]}
            onChange={(e) => {
              if (name === 'phone') {
                handleInputChange({ target: { name, value: e.target.value.replace(/\D/g, '').slice(0, 10) } });
              } else {
                handleInputChange(e);
              }
            }}
            style={{ 
              width: '100%', 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border-color)', 
              color: '#fff', 
              padding: '0.5rem 0.75rem', 
              borderRadius: '6px',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
        ) : (
          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: formData[name] ? '#fff' : 'rgba(255,255,255,0.3)', minHeight: '1.4rem' }}>
            {formData[name] || '—'}
          </div>
        )}
      </div>
    );
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ zIndex: 9999, alignItems: 'flex-start', overflowY: 'auto', padding: '3rem 1rem' }}>
      <div className="modal-content glass" style={{ margin: 'auto', display: 'flex', flexDirection: 'column', maxWidth: '750px', width: '100%', padding: '0', backgroundColor: '#13161c', position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
        
        {/* Header Section */}
        <div style={{ backgroundColor: 'rgba(19, 22, 28, 0.98)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <img src={profile.avatar} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#e28743', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                Employee Inspector
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.4rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 700 }}>{profile.name}</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 600 }}>Active</span>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 600 }}>Biometrics</span>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Role: <span style={{ color: '#fff' }}>{profile.role.split('(')[0].trim()}</span> <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.2)' }}>|</span> Department: <span style={{ color: '#fff' }}>{profile.role.split('(')[1]?.replace(')', '') || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem' }}
              >
                <Edit2 size={14} /> Edit Profile
              </button>
            )}
            <button type="button" className="modal-close-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Section */}
        <div style={{ padding: '2rem' }}>
          {/* Base Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
            {renderField('Gender', 'gender')}
            {renderField('Marital Status', 'marital_status')}
            
            {renderField('Date of Birth', 'dob', 'date')}
            {renderField('Date of Joining', 'doj', 'date')}
            
            {renderField('Aadhaar Card', 'aadhaar_card')}
            {renderField('Blood Group', 'blood_group')}
            
            {renderField('Insurance', 'insurance')}
            {renderField('Phone', 'phone', 'tel')}
            
            {/* Email is read only from profile object but let's show it */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Email</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#fff' }}>{profile.email || '—'}</div>
            </div>
            {renderField('Emergency Contact', 'emergency_contact', 'tel')}
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

        {/* Footer Section */}
        {isEditing && (
          <div style={{ backgroundColor: 'rgba(19, 22, 28, 0.98)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <Save size={18} /> {isSaving ? 'Saving Updates...' : 'Save Profile Details'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CompleteProfileModal;
