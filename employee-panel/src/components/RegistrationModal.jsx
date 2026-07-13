import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Zap, Loader2 } from 'lucide-react';
import './RegistrationModal.css';

const RegistrationModal = ({ session, onComplete }) => {
  const [name, setName] = useState(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
  const [phone, setPhone] = useState('');
  const [dept, setDept] = useState('Sales');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (phone && !/^\d{10}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        user_id: session.user.id,
        name: name.trim(),
        department: dept,
        phone_number: phone.trim() || null,
        is_active: true
      })
      .eq('email', session.user.email);

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
    } else {
      onComplete();
    }
  };

  return (
    <div className="register-overlay">
      <div className="card register-card glass">
        <div className="register-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.65rem' }}>
          <Zap size={36} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px var(--primary))', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'left' }}>
            <span style={{ fontWeight: 900, fontSize: '1.6rem', color: 'var(--primary)', letterSpacing: '0.02em' }}>RYM</span>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#ffffff', letterSpacing: '0.14em' }}>GRENERGY</span>
          </div>
        </div>
        <h3 className="register-title">Complete Your Employee Profile</h3>
        <p className="register-subtitle">Please enter your details to register as a Field Executive</p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group-reg">
            <label>Full Name</label>
            <input
              type="text"
              className="register-input"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group-reg">
            <label>Gmail Address</label>
            <input
              type="email"
              className="register-input"
              value={session.user.email}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group-reg">
            <label>Phone Number</label>
            <input
              type="tel"
              className="register-input"
              placeholder="e.g. 9876543210"
              maxLength="10"
              pattern="^[0-9]{10}$"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div className="form-group-reg">
            <label>Department</label>
            <select
              className="register-input"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="Sales">Sales & Field Operations</option>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Marketing">Marketing</option>
            </select>
          </div>

          <button type="submit" className="btn-primary register-btn" disabled={isLoading}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Loader2 className="spinner" size={18} /> Saving Details...
              </div>
            ) : (
              'Complete Registration'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegistrationModal;
