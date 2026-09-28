import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  CheckCircle,
  AlertCircle,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Star,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { db } from '../../services/db';
import { Hospital, SheetType } from '../../types/database';

export default function SuperAdminPanel() {
  const { isSuperAdmin, hospitals, switchHospital, refreshHospitals } = useAuth();

  if (!isSuperAdmin) {
    return <Navigate to="/staff" replace />;
  }
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitalStats, setHospitalStats] = useState<Record<string, { visits: number; completed: number; reviews: number; avgRating: number }>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    google_place_id: '',
    sheet_id: '',
    sheet_type: 'google_sheets' as SheetType,
    logo: '',
    whatsapp_template_name: 'patient_review_v1',
    admin_name: '',
    admin_email: '',
  });
  const [saving, setSaving] = useState(false);

  // Load metrics for each hospital
  const loadStats = async () => {
    setRefreshing(true);
    const stats: Record<string, { visits: number; completed: number; reviews: number; avgRating: number }> = {};
    for (const h of hospitals) {
      const visits = await db.getVisits(h.id);
      const reviews = visits
        .map((v) => v.review_request?.rating)
        .filter((r): r is number => typeof r === 'number');
      const avg = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;
      stats[h.id] = {
        visits: visits.length,
        completed: visits.filter((v) => v.status === 'completed').length,
        reviews: reviews.length,
        avgRating: Number(avg.toFixed(1)),
      };
    }
    setHospitalStats(stats);
    setRefreshing(false);
  };

  useEffect(() => {
    if (hospitals.length > 0) {
      loadStats();
    }
  }, [hospitals]);

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subdomain.trim()) return;

    setSaving(true);
    try {
      await db.createHospital(
        {
          name: formData.name.trim(),
          subdomain: formData.subdomain.trim().toLowerCase(),
          google_place_id: formData.google_place_id.trim() || 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          sheet_id: formData.sheet_id.trim() || 'demo_sheet_id',
          sheet_type: formData.sheet_type,
          logo: formData.logo.trim() || 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
          whatsapp_template_name: formData.whatsapp_template_name || 'patient_review_v1',
        },
        formData.admin_email
          ? {
              name: formData.admin_name || `${formData.name} Admin`,
              email: formData.admin_email.trim(),
            }
          : undefined
      );

      await refreshHospitals();
      setShowAddModal(false);
      setFormData({
        name: '',
        subdomain: '',
        google_place_id: '',
        sheet_id: '',
        sheet_type: 'google_sheets',
        logo: '',
        whatsapp_template_name: 'patient_review_v1',
        admin_name: '',
        admin_email: '',
      });
    } catch (err) {
      console.error('Failed to create hospital:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Super Admin Multi-Hospital Controller
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global management for all partner hospitals, sheet sync pipelines, and WhatsApp review automation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadStats}
            disabled={refreshing}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Refresh Hospital Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Hospital
          </button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Onboarded Hospitals
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{hospitals.length}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">100% Multi-Tenant Active</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Patient Visits
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {Object.values(hospitalStats).reduce((acc, curr) => acc + curr.visits, 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across all hospital sheets</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Reviews Generated
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {Object.values(hospitalStats).reduce((acc, curr) => acc + curr.reviews, 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Via automated WhatsApp delivery</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            System Network Health
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-sm font-bold text-slate-900">Make Webhooks & DB Ready</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">Row-Level Security active</p>
        </div>
      </div>

      {/* Hospital List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Active Hospitals Directory</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {filteredHospitals.length}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hospital name or subdomain..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Hospital & Subdomain</th>
                <th className="px-4 py-3.5">Sync Source</th>
                <th className="px-4 py-3.5">Sync Status</th>
                <th className="px-4 py-3.5">Visits</th>
                <th className="px-4 py-3.5">Reviews & Avg</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHospitals.map((h) => {
                const stat = hospitalStats[h.id] || { visits: 0, completed: 0, reviews: 0, avgRating: 0 };
                return (
                  <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={h.logo}
                          alt={h.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{h.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {h.subdomain}.rescuebridge.com
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        {h.sheet_type === 'google_sheets' ? 'Google Sheets' : 'Excel 365'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {h.sync_status || 'active'} ({h.last_synced || 'Synced'})
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-800">{stat.visits} Total</p>
                      <p className="text-[11px] text-slate-400">{stat.completed} completed</p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-slate-900">
                          {stat.avgRating > 0 ? stat.avgRating : '—'}
                        </span>
                        <span className="text-slate-400">({stat.reviews})</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => switchHospital(h.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        Manage Dashboard
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Onboard New Hospital</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-tenant isolation with dedicated Place ID and automated sheet sync.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Official Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Care Multi-Specialty Hospital"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subdomain Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. metrocare"
                    value={formData.subdomain}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sheet Type
                  </label>
                  <select
                    value={formData.sheet_type}
                    onChange={(e) =>
                      setFormData({ ...formData, sheet_type: e.target.value as SheetType })
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="google_sheets">Google Sheets</option>
                    <option value="excel_365">Excel 365 / OneDrive</option>
                    <option value="manual">Manual Entry Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Maps Place ID (for 5-Star Reviews)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  value={formData.google_place_id}
                  onChange={(e) => setFormData({ ...formData, google_place_id: e.target.value })}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Logo URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* First Hospital Admin Creation */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  First Hospital Admin Login (Step 4)
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Admin Full Name"
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="admin@hospital.com"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {saving ? 'Creating Hospital...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
