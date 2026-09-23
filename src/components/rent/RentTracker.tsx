import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { RentProperty, RentPortion, RentMonthlyRecord } from '../../types';
import { filterPortionsByProperty, getRentPropertyName, resolvePortionPropertyId } from '../../utils/rentProperties';
import { getPortionFinancialSummary } from '../../utils/rentCalculations';
import { getTodayLocalDateStr } from '../../utils/dateTime';
import { 
  formatCurrency, 
  formatDate, 
  getMonthYearFormatted 
} from '../../utils/formatters';
import { 
  Home, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CreditCard, 
  Edit2, 
  Trash2, 
  User, 
  X, 
  Building, 
  History, 
  MessageSquare,
  DollarSign,
  MapPin
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { MetricCard } from '../ui/MetricCard';
import { EmptyState } from '../ui/EmptyState';

interface RentTrackerProps {
  selectedMonth: string; // YYYY-MM
  onOpenReport?: () => void;
}

export const RentTracker: React.FC<RentTrackerProps> = ({
  selectedMonth,
  onOpenReport
}) => {
  const rentProperties = useLiveQuery(() => db.rent_properties.toArray()) || [];
  const activeProperties = rentProperties.filter(p => p.status === 'active');
  const allPortions = useLiveQuery(() => db.rent_portions.filter(p => p.active).toArray()) || [];
  const allRecords = useLiveQuery(() => db.rent_records.toArray()) || [];

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const portions = filterPortionsByProperty(allPortions, activeProperties, selectedPropertyId);
  const currentMonthRecords = allRecords.filter(r => r.monthYear === selectedMonth);

  // Property management state
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<RentProperty | null>(null);
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyNotes, setPropertyNotes] = useState('');

  // Portion state
  const [isPortionModalOpen, setIsPortionModalOpen] = useState(false);
  const [editingPortion, setEditingPortion] = useState<RentPortion | null>(null);
  const [portionPropertyId, setPortionPropertyId] = useState('');
  const [portionName, setPortionName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [expectedRent, setExpectedRent] = useState('10000');
  const [dueDay, setDueDay] = useState('10');
  const [initialArrears, setInitialArrears] = useState('0');

  // Collect Rent Modal
  const [collectModalData, setCollectModalData] = useState<{
    portion: RentPortion;
    record?: RentMonthlyRecord;
    previousArrears: number;
    currentExpected: number;
    totalDue: number;
  } | null>(null);
  const [arrearsInput, setArrearsInput] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payDateInput, setPayDateInput] = useState(getTodayLocalDateStr());
  const [payMethodInput, setPayMethodInput] = useState('Cash');
  const [payNotesInput, setPayNotesInput] = useState('');

  // Map record by portionId for selectedMonth
  const currentRecordMap = new Map<string, RentMonthlyRecord>();
  currentMonthRecords.forEach(r => currentRecordMap.set(r.portionId, r));

  // Determine current day for overdue calculation
  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const currentDayOfMonth = today.getDate();

  // Helper to compute live status of a portion record with arrears
  const getPortionFinancials = (portion: RentPortion, rec?: RentMonthlyRecord) => {
    return getPortionFinancialSummary(
      portion,
      rec,
      allRecords.filter(r => r.portionId === portion.id),
      selectedMonth,
      currentYearMonth,
      currentDayOfMonth
    );
  };

  // Summary calculations
  let totalCurrentExpected = 0;
  let totalPreviousArrears = 0;
  let totalCollected = 0;

  portions.forEach(p => {
    const rec = currentRecordMap.get(p.id);
    const fin = getPortionFinancials(p, rec);
    totalCurrentExpected += fin.currentExpected;
    totalPreviousArrears += fin.previousArrears;
    totalCollected += fin.paid;
  });

  const totalOverallPayable = totalCurrentExpected + totalPreviousArrears;
  const totalNetOutstanding = Math.max(0, totalOverallPayable - totalCollected);
  const collectionRate = totalOverallPayable > 0 ? Math.round((totalCollected / totalOverallPayable) * 100) : 0;
  const paidCount = portions.filter(p => getPortionFinancials(p, currentRecordMap.get(p.id)).status === 'paid').length;
  const pendingCount = portions.length - paidCount;

  const resetPropertyForm = () => {
    setEditingProperty(null);
    setPropertyName('');
    setPropertyAddress('');
    setPropertyNotes('');
  };

  const handleEditProperty = (property: RentProperty) => {
    setEditingProperty(property);
    setPropertyName(property.name);
    setPropertyAddress(property.address || '');
    setPropertyNotes(property.notes || '');
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = propertyName.trim();
    if (!name) {
      alert('Please enter a house/property name.');
      return;
    }

    const duplicate = rentProperties.some(
      p => p.id !== editingProperty?.id && p.status === 'active' && p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      alert('An active house with this name already exists.');
      return;
    }

    const now = new Date().toISOString();
    if (editingProperty) {
      await db.rent_properties.update(editingProperty.id, {
        name,
        address: propertyAddress.trim() || undefined,
        notes: propertyNotes.trim() || undefined,
        updatedAt: now
      });
    } else {
      const property: RentProperty = {
        id: `property_${Date.now()}`,
        name,
        address: propertyAddress.trim() || undefined,
        notes: propertyNotes.trim() || undefined,
        status: 'active',
        createdAt: now,
        updatedAt: now
      };
      await db.rent_properties.add(property);
      if (selectedPropertyId === 'all') {
        setSelectedPropertyId(property.id);
      }
    }

    resetPropertyForm();
  };

  const handleDeactivateProperty = async (property: RentProperty) => {
    const assignedActivePortions = allPortions.filter(
      p => resolvePortionPropertyId(p, activeProperties) === property.id
    );
    if (assignedActivePortions.length > 0) {
      alert(`${property.name} has ${assignedActivePortions.length} active portion(s). Move or deactivate those portions before deactivating the house.`);
      return;
    }
    if (!confirm(`Deactivate ${property.name}?`)) return;
    await db.rent_properties.update(property.id, {
      status: 'inactive',
      updatedAt: new Date().toISOString()
    });
    if (selectedPropertyId === property.id) setSelectedPropertyId('all');
    resetPropertyForm();
  };

  const openNewPortion = () => {
    resetPortionForm();
    const preferred = selectedPropertyId !== 'all'
      ? selectedPropertyId
      : activeProperties[0]?.id || '';
    setPortionPropertyId(preferred);
    setIsPortionModalOpen(true);
  };

  // Handle Save Portion
  const handleSavePortion = async (e: React.FormEvent) => {
    e.preventDefault();
    const rent = parseFloat(expectedRent);
    const day = parseInt(dueDay, 10);
    const initArr = parseFloat(initialArrears) || 0;
    if (!portionPropertyId || !activeProperties.some(p => p.id === portionPropertyId)) {
      alert('Please select a valid house/property first.');
      return;
    }
    if (!portionName.trim() || !tenantName.trim() || isNaN(rent) || rent <= 0) {
      alert('Please fill valid portion and tenant details.');
      return;
    }

    if (editingPortion) {
      await db.rent_portions.update(editingPortion.id, {
        propertyId: portionPropertyId,
        portionName: portionName.trim(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        expectedRent: rent,
        dueDay: day || 10,
        initialArrears: initArr
      });
      setEditingPortion(null);
    } else {
      const newP: RentPortion = {
        id: `p_${Date.now()}`,
        propertyId: portionPropertyId,
        portionName: portionName.trim(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        expectedRent: rent,
        dueDay: day || 10,
        initialArrears: initArr,
        active: true,
        createdAt: new Date().toISOString()
      };
      await db.rent_portions.add(newP);
    }

    resetPortionForm();
    setIsPortionModalOpen(false);
  };

  const resetPortionForm = () => {
    setEditingPortion(null);
    setPortionPropertyId('');
    setPortionName('');
    setTenantName('');
    setTenantPhone('');
    setExpectedRent('10000');
    setDueDay('10');
    setInitialArrears('0');
  };

  const handleEditPortion = (portion: RentPortion) => {
    setEditingPortion(portion);
    setPortionPropertyId(resolvePortionPropertyId(portion, activeProperties) || '');
    setPortionName(portion.portionName);
    setTenantName(portion.tenantName);
    setTenantPhone(portion.tenantPhone || '');
    setExpectedRent(portion.expectedRent.toString());
    setDueDay(portion.dueDay.toString());
    setInitialArrears((portion.initialArrears || 0).toString());
    setIsPortionModalOpen(true);
  };

  // Open Collect Rent Modal
  const handleOpenCollect = (portion: RentPortion, record?: RentMonthlyRecord) => {
    const fin = getPortionFinancials(portion, record);
    setCollectModalData({
      portion,
      record,
      previousArrears: fin.previousArrears,
      currentExpected: fin.currentExpected,
      totalDue: fin.totalDue
    });
    setArrearsInput(fin.previousArrears.toString());
    setPayAmountInput(record ? record.paidAmount.toString() : fin.totalDue.toString());
    setPayDateInput(record?.paymentDate || getTodayLocalDateStr());
    setPayMethodInput(record?.paymentMethod || 'Cash');
    setPayNotesInput(record?.notes || '');
  };

  // Handle Collect Rent
  const handleCollectRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalData) return;
    const { portion, record } = collectModalData;
    const paid = parseFloat(payAmountInput);
    const parsedArrears = parseFloat(arrearsInput);
    const validArrears = isNaN(parsedArrears) ? 0 : parsedArrears;
    if (isNaN(paid) || paid < 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const currentTotalDue = portion.expectedRent + validArrears;
    const computedStatus = paid >= currentTotalDue && currentTotalDue > 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
    const recordId = record ? record.id : `${selectedMonth}_${portion.id}`;

    const newRecord: RentMonthlyRecord = {
      id: recordId,
      portionId: portion.id,
      portionName: portion.portionName,
      tenantName: portion.tenantName,
      monthYear: selectedMonth,
      expectedAmount: portion.expectedRent,
      arrearsAmount: validArrears,
      paidAmount: paid,
      status: computedStatus,
      paymentDate: payDateInput,
      paymentMethod: payMethodInput,
      notes: payNotesInput.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    await db.rent_records.put(newRecord);
    setCollectModalData(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
<PageHeader
        title="Rent Management"
        subtitle="Multi-house portfolio, portions, monthly dues, collections, and arrears"
        icon={Home}
        primaryAction={{
          label: 'Add Portion',
          icon: Plus,
          onClick: openNewPortion
        }}
        secondaryAction={onOpenReport ? {
          label: 'Rent Report',
          icon: FileText,
          onClick: onOpenReport
        } : undefined}
      >
        <button
          type="button"
          onClick={() => {
            resetPropertyForm();
            setIsPropertyModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-[#0B1D2C] hover:bg-[#102638] text-[#A9BDCC] hover:text-[#F4F8FB] border border-[rgba(70,150,180,0.22)] font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          <Building className="w-4 h-4 text-[#18E6BE]" />
          <span>Manage Houses</span>
        </button>
      </PageHeader>

      {/* Property Portfolio Selector */}
      <div className="bg-[#0B1D2C] rounded-2xl border border-cyan-500/20 shadow-lg p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setSelectedPropertyId('all')}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedPropertyId === 'all'
                ? 'bg-gradient-to-r from-teal-500 to-[#18E6BE] text-[#06131F] font-black border-transparent shadow-[0_0_15px_rgba(24,230,190,0.3)]'
                : 'bg-[#071724] text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            All Houses
            <span className="ml-1.5 opacity-70">({allPortions.length})</span>
          </button>

          {activeProperties.map(property => {
            const count = allPortions.filter(
              p => resolvePortionPropertyId(p, activeProperties) === property.id
            ).length;
            return (
              <button
                key={property.id}
                onClick={() => setSelectedPropertyId(property.id)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  selectedPropertyId === property.id
                    ? 'bg-gradient-to-r from-teal-500 to-[#18E6BE] text-[#06131F] font-black border-transparent shadow-[0_0_15px_rgba(24,230,190,0.3)]'
                    : 'bg-[#071724] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                {property.name}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              resetPropertyForm();
              setIsPropertyModalOpen(true);
            }}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold text-[#18E6BE] hover:bg-[#102638] border border-dashed border-teal-500/40 transition-colors"
          >
            + Add House
          </button>
        </div>
      </div>

      {/* Monthly & Arrears Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Collected Rent"
          value={formatCurrency(totalCollected)}
          subtitle={`Total Payable: ${formatCurrency(totalOverallPayable)} (${collectionRate}%)`}
          icon={DollarSign}
          variant="accent"
        />

        <MetricCard
          title="Total Outstanding"
          value={formatCurrency(totalNetOutstanding)}
          subtitle={`Current: ${formatCurrency(Math.max(0, totalCurrentExpected - totalCollected))} • Arrears: ${formatCurrency(totalPreviousArrears)}`}
          icon={AlertTriangle}
          variant="warning"
        />

        <MetricCard
          title="Previous Arrears"
          value={formatCurrency(totalPreviousArrears)}
          subtitle="Accumulated from past months"
          icon={History}
          variant="danger"
        />

        <div className="bg-[#0B1D2C] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Collection Status
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{paidCount} Paid</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Clock className="w-4 h-4" />
                <span>{pendingCount} Pending</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Progress</span>
              <span className="text-teal-300">{collectionRate}%</span>
            </div>
            <div className="w-full bg-[#071724] h-2 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-teal-500 to-[#18E6BE] h-full rounded-full transition-all" 
                style={{ width: `${Math.min(100, collectionRate)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Portions Grid for Selected Month */}
      {portions.length === 0 ? (
<EmptyState
          icon={Building}
          title="No Rental Portions Added"
          description="Add your house portions or apartments along with tenant details to start tracking monthly rents and collections."
          action={{
            label: 'Add First Portion',
            onClick: openNewPortion
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portions.map(portion => {
            const record = currentRecordMap.get(portion.id);
            const fin = getPortionFinancials(portion, record);

            const isPaid = fin.status === 'paid';
            const isPartial = fin.status === 'partially_paid';
            const isOverdue = fin.status === 'overdue';

            return (
              <div
                key={portion.id}
                className={`bg-[#0B1D2C] rounded-3xl p-5 border transition-all shadow-lg flex flex-col justify-between gap-4 ${
                  isPaid
                    ? 'border-teal-500/40 hover:border-teal-400/60'
                    : isOverdue
                    ? 'border-rose-500/40 hover:border-rose-400/60'
                    : isPartial
                    ? 'border-blue-500/40 hover:border-blue-400/60'
                    : 'border-cyan-500/20 hover:border-cyan-500/40'
                }`}
              >
                <div>
                  {/* Top Row: Portion Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold border ${
                        isPaid
                          ? 'bg-teal-500/20 text-[#18E6BE] border-teal-500/30'
                          : isOverdue
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : isPartial
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-white text-base">{portion.portionName}</h3>
                          {selectedPropertyId === 'all' && (
                            <span className="px-2 py-0.5 rounded-full bg-[#102638] text-teal-300 text-[10px] font-bold border border-teal-500/30">
                              {getRentPropertyName(resolvePortionPropertyId(portion, activeProperties), activeProperties)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{portion.tenantName}</span>
                          {portion.tenantPhone && (
                            <span className="text-slate-500">({portion.tenantPhone})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 border ${
                      isPaid
                        ? 'bg-teal-500/20 text-[#18E6BE] border-teal-500/40'
                        : isOverdue
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : isPartial
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {isPaid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PAID
                        </>
                      ) : isOverdue ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          OVERDUE
                        </>
                      ) : isPartial ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          PARTIAL
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          PENDING
                        </>
                      )}
                    </span>
                  </div>

                  {/* Amount Breakdown Matrix including Previous Arrears */}
                  <div className="grid grid-cols-4 gap-2 bg-[#071724] p-3 rounded-2xl mt-3.5 text-center border border-slate-800">
                    <div>
<div className="text-[9px] text-slate-400 font-bold uppercase">Current Rent</div>
                      <div className="font-bold text-slate-200 text-xs sm:text-sm mt-0.5">
                        {formatCurrency(fin.currentExpected)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-rose-400 font-bold uppercase flex items-center justify-center gap-0.5">
                        <History className="w-2.5 h-2.5" />
                        Arrears
                      </div>
                      <div className={`font-bold text-xs sm:text-sm mt-0.5 ${
                        fin.previousArrears > 0 ? 'text-rose-400 font-black' : 'text-slate-400'
                      }`}>
                        {formatCurrency(fin.previousArrears)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Collected</div>
                      <div className="font-bold text-[#18E6BE] text-xs sm:text-sm mt-0.5">
                        {formatCurrency(fin.paid)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Remaining</div>
                      <div className="font-extrabold text-white text-xs sm:text-sm mt-0.5">
                        {formatCurrency(fin.netRemaining)}
                      </div>
                    </div>
                  </div>

                  {/* Total Payable banner if Arrears exist */}
                  {fin.previousArrears > 0 && (
                    <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 mt-2.5 flex items-center justify-between text-xs text-amber-300">
                      <span className="font-semibold">Total Due (Current + Arrears):</span>
                      <strong className="font-black text-amber-200 text-sm">{formatCurrency(fin.totalDue)}</strong>
                    </div>
                  )}

                  {/* Payment Detail if recorded */}
                  {record && (
                    <div className="text-xs text-slate-400 mt-2.5 flex items-center justify-between pt-1">
                      <span>
                        {record.paymentDate ? `Paid on ${formatDate(record.paymentDate, 'short')}` : 'No payment date'} 
                        {record.paymentMethod ? ` via ${record.paymentMethod}` : ''}
                      </span>
                      {record.notes && <span className="text-slate-400 font-medium italic">"{record.notes}"</span>}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditPortion(portion)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#102638] rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    {portion.tenantPhone && (
                      <button
                        onClick={() => {
                          const cleanPhone = portion.tenantPhone?.replace(/[^0-9]/g, '') || '';
                          const phoneWithCountry = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
                          const msg = isPaid
                            ? `Assalam-o-Alaikum ${portion.tenantName},\n\n${portion.portionName} ka ${getMonthYearFormatted(selectedMonth)} ka rent (${formatCurrency(record?.paidAmount || fin.totalDue)}) receive ho chuka hai.\nPayment Method: ${record?.paymentMethod || 'Cash'}\nDate: ${record?.paymentDate || ''}\n\nShukriya!`
                            : `Assalam-o-Alaikum ${portion.tenantName},\n\n${portion.portionName} ka ${getMonthYearFormatted(selectedMonth)} ka rent (${formatCurrency(fin.totalDue)}) payable hai.\nBaraye meherbani payment clear karein.\n\nShukriya!`;
                          window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="p-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Send WhatsApp Receipt / Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenCollect(portion, record)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                      isPaid
                        ? 'bg-[#102638] hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] font-black shadow-teal-500/20'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    {isPaid ? 'Update Payment' : 'Collect Rent'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: COLLECT RENT / UPDATE RECORD */}
      {collectModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1D2C] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg">
                  Collect Rent — {collectModalData.portion.portionName}
                </h3>
                <p className="text-xs text-slate-400">
                  Tenant: <strong className="text-teal-300">{collectModalData.portion.tenantName}</strong> • {getMonthYearFormatted(selectedMonth)}
                </p>
              </div>
              <button
                onClick={() => setCollectModalData(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectRent} className="space-y-4 mt-4 overflow-y-auto pr-1">
              {/* Detailed Breakdown with Editable Arrears */}
              <div className="bg-[#071724] p-3.5 rounded-2xl space-y-2 text-xs border border-slate-800">
                <div className="flex justify-between text-slate-300">
                  <span>Current Month Rent ({getMonthYearFormatted(selectedMonth).split(' ')[0]}):</span>
                  <span className="font-bold text-white">{formatCurrency(collectModalData.currentExpected)}</span>
                </div>
                
                {/* Editable Arrears Field */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-rose-400 flex items-center gap-1">
                      <History className="w-3 h-3" />
                      Arrears for this portion (PKR):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={arrearsInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setArrearsInput(val);
                        const arr = parseFloat(val) || 0;
                        const total = collectModalData.currentExpected + arr;
                        if (!payAmountInput || payAmountInput === collectModalData.totalDue.toString()) {
                          setPayAmountInput(total.toString());
                        }
                      }}
                      className="w-28 px-2 py-1 bg-[#0B1D2C] border border-rose-500/40 rounded-lg text-xs font-bold text-rose-300 text-right focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Adjust or override arrears balance for this month if needed.
                  </p>
                </div>

                <div className="flex justify-between text-white pt-2 border-t border-slate-800 font-extrabold text-sm">
                  <span>Total Amount Due:</span>
                  <span className="text-[#18E6BE]">
                    {formatCurrency(collectModalData.currentExpected + (parseFloat(arrearsInput) || 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-base font-bold text-white focus:ring-2 focus:ring-cyan-500/30 focus:border-[#18E6BE] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDateInput}
                    onChange={(e) => setPayDateInput(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payMethodInput}
                    onChange={(e) => setPayMethodInput(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE]"
                  >
                    <option value="Cash" className="bg-[#0B1D2C]">Cash</option>
                    <option value="Bank Transfer" className="bg-[#0B1D2C]">Bank Transfer</option>
                    <option value="JazzCash" className="bg-[#0B1D2C]">JazzCash</option>
                    <option value="EasyPaisa" className="bg-[#0B1D2C]">EasyPaisa</option>
                    <option value="Cheque" className="bg-[#0B1D2C]">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notes / Receipt Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid arrears + current rent"
                  value={payNotesInput}
                  onChange={(e) => setPayNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-cyan-500/30 focus:border-[#18E6BE]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectModalData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20"
                >
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE HOUSES / PROPERTIES */}
      {isPropertyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1D2C] rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg">Manage Houses</h3>
                <p className="text-xs text-slate-400">Create properties first, then assign portions/tenants to each house.</p>
              </div>
              <button
                onClick={() => {
                  setIsPropertyModalOpen(false);
                  resetPropertyForm();
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeProperties.length > 0 && (
              <div className="space-y-2 mt-4">
                {activeProperties.map(property => {
                  const count = allPortions.filter(
                    p => resolvePortionPropertyId(p, activeProperties) === property.id
                  ).length;
                  return (
                    <div key={property.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#071724] border border-slate-800">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm">{property.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          {property.address && <><MapPin className="w-3 h-3 text-teal-400" />{property.address}<span>•</span></>}
                          <span>{count} active {count === 1 ? 'portion' : 'portions'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditProperty(property)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-[#102638] border border-slate-700"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSaveProperty} className="space-y-3 mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs font-black uppercase tracking-wider text-teal-400">
                {editingProperty ? `Edit ${editingProperty.name}` : 'Add New House'}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">House Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. House 2"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Property address"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Main house, rental building"
                  value={propertyNotes}
                  onChange={(e) => setPropertyNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs text-white focus:border-[#18E6BE] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingProperty && (
                  <button
                    type="button"
                    onClick={() => handleDeactivateProperty(editingProperty)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate House
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {editingProperty && (
                    <button
                      type="button"
                      onClick={resetPropertyForm}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] rounded-xl font-bold text-xs shadow-md shadow-teal-500/20"
                  >
                    {editingProperty ? 'Save House' : 'Add House'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE PORTIONS */}
      {isPortionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1D2C] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-cyan-500/30 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">
                {editingPortion ? 'Edit Portion Details' : 'Add New Portion Unit'}
              </h3>
              <button
                onClick={() => {
                  setIsPortionModalOpen(false);
                  resetPortionForm();
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePortion} className="space-y-3 mt-4 overflow-y-auto pr-1">
              <div>
<label className="block text-xs font-bold text-slate-300 mb-1">
                  House / Property *
                </label>
                <select
                  required
                  value={portionPropertyId}
                  onChange={(e) => setPortionPropertyId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#18E6BE]"
                >
                  <option value="" className="bg-[#0B1D2C] text-slate-400">Select house</option>
                  {activeProperties.map(property => (
                    <option key={property.id} value={property.id} className="bg-[#0B1D2C] text-white">{property.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Portion Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Portion 1, Upper Flat, Ground Floor"
                  value={portionName}
                  onChange={(e) => setPortionName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ali Khan"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tenant Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="0300-1234567"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:border-[#18E6BE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Monthly Rent (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={expectedRent}
                    onChange={(e) => setExpectedRent(e.target.value)}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-[#18E6BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Due Day of Month *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-[#18E6BE]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Opening / Previous Arrears (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={initialArrears}
                  onChange={(e) => setInitialArrears(e.target.value)}
                  className="w-full px-3 py-2 bg-[#071724] border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-[#18E6BE]"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Initial arrears balance before tracking or carried forward.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingPortion && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to deactivate this portion?')) return;
                      await db.rent_portions.update(editingPortion.id, { active: false });
                      setIsPortionModalOpen(false);
                      resetPortionForm();
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPortionModalOpen(false);
                      resetPortionForm();
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] text-[#06131F] font-bold text-xs rounded-xl shadow-md"
                  >
                    {editingPortion ? 'Save Changes' : 'Add Portion'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
