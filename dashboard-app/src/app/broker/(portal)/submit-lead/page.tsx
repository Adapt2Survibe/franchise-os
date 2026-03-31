'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Check, CheckSquare, Square } from 'lucide-react';
import { PLACEHOLDER_BRANDS, CATEGORY_OPTIONS, US_STATES } from '@/types/broker';

export default function SubmitLeadPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    candidateName: '',
    phone: '',
    email: '',
    streetAddress: '',
    city: '',
    state: '',
    liquidCapital: '',
    netWorth: '',
    budget: '',
    categoryInterests: [] as string[],
    brandSubmittedTo: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (category: string) => {
    setForm((prev) => {
      const current = prev.categoryInterests;
      const updated = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, categoryInterests: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/broker/dashboard');
    }, 1500);
  };

  const inputClass =
    'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Lead Submitted!</h2>
        <p className="text-sm text-slate-400">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit a Lead</h1>
        <p className="mt-1 text-slate-400">Enter the candidate&apos;s information below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Candidate Information */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Candidate Information</h2>

          <div>
            <label htmlFor="candidateName" className={labelClass}>Full Name</label>
            <input id="candidateName" type="text" value={form.candidateName} onChange={(e) => updateField('candidateName', e.target.value)} placeholder="Candidate's full name" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="candidatePhone" className={labelClass}>Phone Number</label>
              <input id="candidatePhone" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 123-4567" className={inputClass} />
            </div>
            <div>
              <label htmlFor="candidateEmail" className={labelClass}>Email Address</label>
              <input id="candidateEmail" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="candidate@email.com" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="streetAddress" className={labelClass}>Street Address</label>
            <input id="streetAddress" type="text" value={form.streetAddress} onChange={(e) => updateField('streetAddress', e.target.value)} placeholder="123 Main St" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="City" className={inputClass} />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>State</label>
              <select id="state" value={form.state} onChange={(e) => updateField('state', e.target.value)} className={inputClass}>
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Financial Information */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Financial Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="liquidCapital" className={labelClass}>Liquid Capital</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input id="liquidCapital" type="text" value={form.liquidCapital} onChange={(e) => updateField('liquidCapital', e.target.value)} placeholder="250,000" className={`${inputClass} pl-7`} />
              </div>
            </div>
            <div>
              <label htmlFor="netWorth" className={labelClass}>Net Worth</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input id="netWorth" type="text" value={form.netWorth} onChange={(e) => updateField('netWorth', e.target.value)} placeholder="500,000" className={`${inputClass} pl-7`} />
              </div>
            </div>
            <div>
              <label htmlFor="budget" className={labelClass}>Budget</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input id="budget" type="text" value={form.budget} onChange={(e) => updateField('budget', e.target.value)} placeholder="150,000" className={`${inputClass} pl-7`} />
              </div>
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Interests</h2>

          <div>
            <label className={labelClass}>Category Interest(s)</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CATEGORY_OPTIONS.map((category) => {
                const selected = form.categoryInterests.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      selected
                        ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {selected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="brand" className={labelClass}>Brand Submitting To</label>
            <select id="brand" value={form.brandSubmittedTo} onChange={(e) => updateField('brandSubmittedTo', e.target.value)} className={inputClass}>
              <option value="">Select a brand</option>
              {PLACEHOLDER_BRANDS.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            Submit Lead
          </button>
        </div>
      </form>
    </div>
  );
}
