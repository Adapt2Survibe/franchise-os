'use client';

import { useState } from 'react';
import {
  Kanban,
  MapPin,
  Calendar,
  DollarSign,
  Mail,
  Phone,
  Tag,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { DUMMY_LEADS } from '@/data/broker-dummy-data';
import { PIPELINE_COLUMNS } from '@/types/broker';
import type { BrokerLead } from '@/types/broker';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function LeadCard({ lead }: { lead: BrokerLead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/50 hover:border-slate-600 transition-all cursor-pointer group"
    >
      {/* Card Preview — always visible */}
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium text-white line-clamp-1">
          {lead.candidateName}
        </h4>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ease-out flex-shrink-0 ml-2 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
        <Building2 className="w-3 h-3" />
        <span className="truncate">{lead.brandSubmittedTo}</span>
      </div>

      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {lead.city}, {lead.state}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(lead.submittedAt)}
        </span>
      </div>

      {/* Expanded Details — animated */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pt-3 border-t border-slate-700/50 space-y-2.5">
          {/* Contact */}
          <div className="flex items-center gap-2 text-xs">
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300">{lead.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300">{lead.phone}</span>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="rounded-md bg-slate-800/80 px-2 py-1.5 text-center">
              <p className="text-[9px] text-slate-500 uppercase">Liquid</p>
              <p className="text-xs font-medium text-white">{formatCurrency(lead.liquidCapital)}</p>
            </div>
            <div className="rounded-md bg-slate-800/80 px-2 py-1.5 text-center">
              <p className="text-[9px] text-slate-500 uppercase">Net Worth</p>
              <p className="text-xs font-medium text-white">{formatCurrency(lead.netWorth)}</p>
            </div>
            <div className="rounded-md bg-slate-800/80 px-2 py-1.5 text-center">
              <p className="text-[9px] text-slate-500 uppercase">Budget</p>
              <p className="text-xs font-medium text-white">{formatCurrency(lead.budget)}</p>
            </div>
          </div>

          {/* Category Interests */}
          <div className="flex items-start gap-1.5 mt-2">
            <Tag className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {lead.categoryInterests.map((cat) => (
                <span
                  key={cat}
                  className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrokerDashboardPage() {
  const grouped = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    items: DUMMY_LEADS.filter((lead) => lead.status === col.key),
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-slate-400">
            Track your submitted leads across the pipeline
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Kanban className="w-4 h-4 text-violet-400" />
          <span>{DUMMY_LEADS.length} leads</span>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map((column) => (
          <div
            key={column.key}
            className="flex-shrink-0 w-72 rounded-xl border border-slate-700 bg-slate-800/50 p-3"
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`w-2 h-2 rounded-full ${column.dot}`} />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {column.label}
              </span>
              <span className="text-xs text-slate-500 font-medium ml-auto">
                {column.items.length}
              </span>
            </div>

            {/* Column Body */}
            <div className="space-y-2 min-h-[120px]">
              {column.items.length === 0 ? (
                <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-slate-700 text-slate-600 text-[10px]">
                  No leads
                </div>
              ) : (
                column.items.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
