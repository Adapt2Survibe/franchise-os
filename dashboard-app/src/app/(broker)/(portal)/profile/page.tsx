'use client';

import { useState } from 'react';
import { Save, Check, CheckSquare, Square } from 'lucide-react';
import { DUMMY_BROKER } from '@/data/broker-dummy-data';
import { BROKER_NETWORKS, type ContactMethod, type PaymentMethod } from '@/types/broker';

const CONTACT_METHODS: { value: ContactMethod; label: string }[] = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'text',  label: 'Text' },
  { value: 'email', label: 'Email' },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'wire',           label: 'Wire Transfer' },
  { value: 'direct_deposit', label: 'Direct Deposit' },
  { value: 'paypal',         label: 'PayPal' },
];

export default function BrokerProfilePage() {
  const [form, setForm] = useState({
    fullName: DUMMY_BROKER.fullName,
    email: DUMMY_BROKER.email,
    phone: DUMMY_BROKER.phone,
    networkOrIndependent: DUMMY_BROKER.networkOrIndependent,
    about: DUMMY_BROKER.about,
    unitsSold: DUMMY_BROKER.unitsSold,
    preferredContact: [...DUMMY_BROKER.preferredContact] as ContactMethod[],
    businessName: DUMMY_BROKER.businessName,
    businessWebsite: DUMMY_BROKER.businessWebsite,
    calendarLink: DUMMY_BROKER.calendarLink,
    paymentPreference: DUMMY_BROKER.paymentPreference,
  });
  const [saved, setSaved] = useState(false);

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const toggleContact = (method: ContactMethod) => {
    setForm((prev) => {
      const current = prev.preferredContact;
      const updated = current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method];
      return { ...prev, preferredContact: updated };
    });
    setSaved(false);
  };

  const allContactSelected = form.preferredContact.length === CONTACT_METHODS.length;

  const toggleAll = () => {
    setForm((prev) => ({
      ...prev,
      preferredContact: allContactSelected ? [] : CONTACT_METHODS.map((m) => m.value),
    }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputClass =
    'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-slate-400">Manage your broker account</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal Info */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Personal Info</h2>

          <div>
            <label htmlFor="fullName" className={labelClass}>Full Name</label>
            <input id="fullName" type="text" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="Your full name" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone Number</label>
              <input id="phone" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 123-4567" className={inputClass} />
            </div>
          </div>
        </section>

        {/* Broker Details */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Broker Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="network" className={labelClass}>Network</label>
              <select id="network" value={form.networkOrIndependent} onChange={(e) => updateField('networkOrIndependent', e.target.value)} className={inputClass}>
                {BROKER_NETWORKS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="unitsSold" className={labelClass}>Units Sold</label>
              <input id="unitsSold" type="number" value={form.unitsSold} onChange={(e) => updateField('unitsSold', Number(e.target.value))} min={0} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="about" className={labelClass}>About</label>
            <textarea id="about" value={form.about} onChange={(e) => updateField('about', e.target.value)} placeholder="Tell franchisors about yourself..." rows={4} className={`${inputClass} resize-none`} />
          </div>
        </section>

        {/* Preferred Contact Method */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Preferred Contact Method</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              {allContactSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {CONTACT_METHODS.map((method) => {
              const selected = form.preferredContact.includes(method.value);
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => toggleContact(method.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                      : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {method.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Business Info */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Business Info</h2>

          <div>
            <label htmlFor="businessName" className={labelClass}>Business Name</label>
            <input id="businessName" type="text" value={form.businessName} onChange={(e) => updateField('businessName', e.target.value)} placeholder="Your business name" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="businessWebsite" className={labelClass}>Business Website</label>
              <input id="businessWebsite" type="url" value={form.businessWebsite} onChange={(e) => updateField('businessWebsite', e.target.value)} placeholder="https://example.com" className={inputClass} />
            </div>
            <div>
              <label htmlFor="calendarLink" className={labelClass}>Calendar Link</label>
              <input id="calendarLink" type="url" value={form.calendarLink} onChange={(e) => updateField('calendarLink', e.target.value)} placeholder="https://calendly.com/you" className={inputClass} />
            </div>
          </div>
        </section>

        {/* Payment Preference */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Payment Preference</h2>

          <div>
            <label htmlFor="payment" className={labelClass}>Preferred Payment Method</label>
            <select id="payment" value={form.paymentPreference} onChange={(e) => updateField('paymentPreference', e.target.value)} className={inputClass}>
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
