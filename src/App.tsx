import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, Firestore, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { 
  Plus, Building2, UserPlus, Trash2, Edit2, ChevronRight, 
  FileText, Search, Mail, X, Download, Eye, CheckCircle2,
  ShieldCheck, ExternalLink, Fingerprint, Lock, 
  LogOut, Users, TrendingUp, Calendar, Image as ImageIcon,
  Database, LayoutDashboard
} from 'lucide-react';
import { ReceiptCertificate } from './components/ReceiptCertificate';
import { DonorSearchSelect } from './components/DonorSearchSelect';
import { BRAND, APP_STATE_KEY } from './constants/brand';
import { downloadReceiptPdf, getReceiptFilename, openReceiptPdfInNewTab } from './utils/receiptPdf';
import { sendReceiptEmailToDonor } from './utils/sendReceiptEmail';
import { currentFinancialYear, formatDateDDMMYYYY, formatSentAt, todayInputDateValue } from './utils/format';

// --- Interfaces for TypeScript Safety ---
interface Organization {
  id: string;
  name: string;
  pan: string;
  regNo: string;
  address: string;
  signatureBase64?: string | null;
}

interface Donor {
  id: string;
  name: string;
  pan: string;
  email: string;
  phone?: string;
  address: string;
}

interface Donation {
  id: string;
  orgId: string;
  donorId: string;
  amount: number;
  date: string;
  paymentMode: string;
  refNo?: string;
  emailSentAt?: string | null;
}

interface ReceiptData {
  donor: Donor | undefined;
  donation: Donation;
}

// --- Your Hardcoded Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBDRXPaPrBF0GcbGhjyvErg7i2VIaIBy1s",
  authDomain: "lata-agrawal-foundation.firebaseapp.com",
  projectId: "lata-agrawal-foundation",
  storageBucket: "lata-agrawal-foundation.firebasestorage.app",
  messagingSenderId: "69085237464",
  appId: "1:69085237464:web:fa586311e18b970e6107ad",
  measurementId: "G-50LD2KWDSZ"
};

// --- Constants ---
const VIEWS = {
  DASHBOARD: 'dashboard',
  DONORS: 'donors',
  LEDGER: 'ledger',
  ALL_RECEIPTS: 'all_receipts',
} as const;

type ViewType = typeof VIEWS[keyof typeof VIEWS];

interface PersistedAppState {
  currentView: ViewType;
  selectedOrgId: string | null;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}

const PAYMENT_MODES = ['Online Transfer', 'UPI', 'Cheque', 'Cash', 'Other'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(localStorage.getItem('isAuthorized_80G') === 'true');
  const [currentView, setCurrentView] = useState<ViewType>(VIEWS.DASHBOARD);
  
  // Data State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [masterDonors, setMasterDonors] = useState<Donor[]>([]); 
  const [allDonations, setAllDonations] = useState<Donation[]>([]);
  
  // Selection & UI State
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string>('');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState<boolean>(false);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState<boolean>(false);
  const [pendingPdfAction, setPendingPdfAction] = useState<'download' | 'open' | null>(null);
  const [isEmailSending, setIsEmailSending] = useState<boolean>(false);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);
  const [emailSendSuccess, setEmailSendSuccess] = useState<boolean>(false);
  const [donationDonorId, setDonationDonorId] = useState<string>('');
  const [donorModalAfterSave, setDonorModalAfterSave] = useState<((donorId: string) => void) | null>(null);
  const [stateRestored, setStateRestored] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const firebaseRefs = useRef<{ auth: Auth | null; db: Firestore | null }>({ auth: null, db: null });
  const receiptCaptureRef = useRef<HTMLDivElement>(null);
  const pendingOrgIdRef = useRef<string | null>(null);

  const goToDashboard = () => {
    setCurrentView(VIEWS.DASHBOARD);
    setSelectedOrg(null);
  };

  const openLedger = (org: Organization) => {
    setSelectedOrg(org);
    setCurrentView(VIEWS.LEDGER);
  };

  const getReceiptFilenameForActive = () => {
    if (!activeReceiptData) return '80G-Receipt.pdf';
    return getReceiptFilename(
      activeReceiptData.donation.id,
      activeReceiptData.donor?.name
    );
  };

  const runReceiptPdfAction = async (
    action: 'download' | 'open'
  ) => {
    const element = receiptCaptureRef.current;
    if (!element || !activeReceiptData || !selectedOrg) return;

    setIsPdfGenerating(true);
    try {
      const filename = getReceiptFilenameForActive();
      if (action === 'download') {
        await downloadReceiptPdf(element, filename);
      } else {
        const title = activeReceiptData.donor?.name
          ? `80G Receipt — ${activeReceiptData.donor.name} | ${selectedOrg.name}`
          : `80G Receipt | ${selectedOrg.name}`;
        await openReceiptPdfInNewTab(element, { title });
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Could not generate the receipt PDF. Please try again.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const openReceiptPreview = (donor: Donor | undefined, donation: Donation) => {
    setActiveReceiptData({ donor, donation });
    setIsReceiptModalOpen(true);
  };

  const downloadReceiptFromLedger = (donor: Donor | undefined, donation: Donation) => {
    setActiveReceiptData({ donor, donation });
    setIsReceiptModalOpen(false);
    setPendingPdfAction('download');
  };

  const openEmailModal = (donor: Donor | undefined, donation: Donation) => {
    setActiveReceiptData({ donor, donation });
    setEmailSendError(null);
    setEmailSendSuccess(false);
    setIsEmailModalOpen(true);
  };

  const handleSendReceiptEmail = async () => {
    const donor = activeReceiptData?.donor;
    const donation = activeReceiptData?.donation;
    const element = receiptCaptureRef.current;

    if (!donor?.email || !donation || !selectedOrg) {
      setEmailSendError('Donor email address is required.');
      return;
    }
    if (!element) {
      setEmailSendError('Receipt is still loading. Please try again in a moment.');
      return;
    }

    setIsEmailSending(true);
    setEmailSendError(null);
    setEmailSendSuccess(false);

    try {
      await sendReceiptEmailToDonor({
        element,
        to: donor.email,
        donorName: donor.name,
        amount: donation.amount,
        orgName: selectedOrg.name,
        orgAddress: selectedOrg.address,
        receiptNo: `80G-${donation.id.slice(-8).toUpperCase()}`,
        donationDate: formatDateDDMMYYYY(donation.date),
        paymentMode: donation.paymentMode,
        pdfFilename: getReceiptFilename(donation.id, donor.name),
      });
      const { db } = firebaseRefs.current;
      if (db && user) {
        await updateDoc(doc(collection(db, 'users', user.uid, 'donations'), donation.id), {
          emailSentAt: new Date().toISOString(),
        });
      }
      setEmailSendSuccess(true);
    } catch (err) {
      console.error(err);
      setEmailSendError(err instanceof Error ? err.message : 'Could not send email.');
    } finally {
      setIsEmailSending(false);
    }
  };

  useEffect(() => {
    if (!pendingPdfAction || !activeReceiptData || !selectedOrg || !receiptCaptureRef.current) return;
    const action = pendingPdfAction;
    setPendingPdfAction(null);
    void runReceiptPdfAction(action);
  }, [pendingPdfAction, activeReceiptData, selectedOrg]);

  // Restore view after refresh
  useEffect(() => {
    if (!isAuthorized || stateRestored) return;
    try {
      const raw = sessionStorage.getItem(APP_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedAppState;
        if (saved.currentView && Object.values(VIEWS).includes(saved.currentView)) {
          setCurrentView(saved.currentView);
        }
        pendingOrgIdRef.current = saved.selectedOrgId ?? null;
        if (saved.searchTerm) setSearchTerm(saved.searchTerm);
        if (saved.startDate) setStartDate(saved.startDate);
        if (saved.endDate) setEndDate(saved.endDate);
      }
    } catch {
      /* ignore */
    }
    setStateRestored(true);
  }, [isAuthorized, stateRestored]);

  useEffect(() => {
    if (!isAuthorized || !stateRestored) return;
    const payload: PersistedAppState = {
      currentView,
      selectedOrgId: selectedOrg?.id ?? null,
      searchTerm,
      startDate,
      endDate,
    };
    sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(payload));
  }, [currentView, selectedOrg, searchTerm, startDate, endDate, isAuthorized, stateRestored]);

  useEffect(() => {
    if (!pendingOrgIdRef.current || !organizations.length) return;
    const org = organizations.find((o) => o.id === pendingOrgIdRef.current);
    if (org) setSelectedOrg(org);
    pendingOrgIdRef.current = null;
  }, [organizations]);

  // --- 1. Firebase Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth: Auth = getAuth(app);
        const db: Firestore = getFirestore(app);
        firebaseRefs.current = { auth, db };

        await signInAnonymously(auth);

        onAuthStateChanged(auth, (u: User | null) => {
          setUser(u);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Firebase Init Error:", err);
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // --- 2. Real-time Data Sync ---
  useEffect(() => {
    const { db } = firebaseRefs.current;
    if (!user || !isAuthorized || !db) return;

    const orgsRef = collection(db, 'users', user.uid, 'organizations');
    const unsubOrgs = onSnapshot(orgsRef, (s: QuerySnapshot<DocumentData>) => {
      setOrganizations(s.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Organization)));
    });

    const donorsRef = collection(db, 'users', user.uid, 'donors');
    const unsubDonors = onSnapshot(donorsRef, (s: QuerySnapshot<DocumentData>) => {
      setMasterDonors(s.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Donor)));
    });

    const donationsRef = collection(db, 'users', user.uid, 'donations');
    const unsubDonations = onSnapshot(donationsRef, (s: QuerySnapshot<DocumentData>) => {
      setAllDonations(s.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Donation)));
    });

    return () => { unsubOrgs(); unsubDonors(); unsubDonations(); };
  }, [user, isAuthorized]);

  // --- 3. Dashboard Analytics ---
  const stats = useMemo(() => {
    const totalAmount = allDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(fyYear, 3, 1);
    const fyEnd = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999);
    const fyDonations = allDonations.filter((d) => {
      const dt = new Date(d.date);
      return dt >= fyStart && dt <= fyEnd;
    });
    const fyAmount = fyDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    return {
      orgs: organizations.length,
      donors: masterDonors.length,
      donationsCount: allDonations.length,
      totalAmount,
      fyAmount,
      fyCount: fyDonations.length,
    };
  }, [organizations, masterDonors, allDonations]);

  const allReceiptsFiltered = useMemo(() => {
    return allDonations
      .filter((d) => {
        const donor = masterDonors.find((m) => m.id === d.donorId);
        const org = organizations.find((o) => o.id === d.orgId);
        const matchesSearch =
          !searchTerm ||
          donor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          donor?.pan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const donationDate = new Date(d.date);
        const matchesStart = !startDate || donationDate >= new Date(startDate);
        const matchesEnd = !endDate || donationDate <= new Date(endDate);
        return matchesSearch && matchesStart && matchesEnd;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allDonations, masterDonors, organizations, searchTerm, startDate, endDate]);

  const openDonorModalFromDonation = () => {
    setEditingItem(null);
    setDonorModalAfterSave(() => (donorId: string) => {
      setDonationDonorId(donorId);
      setIsDonorModalOpen(false);
    });
    setIsDonorModalOpen(true);
  };

  const getOrgForDonation = (donation: Donation): Organization | undefined =>
    organizations.find((o) => o.id === donation.orgId);

  // --- 4. Handlers ---
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('email') === 'admin@agrawalfoundation.org' && fd.get('password') === 'Password@123') {
      setIsAuthorized(true);
      localStorage.setItem('isAuthorized_80G', 'true');
    } else { setLoginError('Invalid Credentials'); }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    localStorage.removeItem('isAuthorized_80G');
    sessionStorage.removeItem(APP_STATE_KEY);
    setCurrentView(VIEWS.DASHBOARD);
    setSelectedOrg(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (res: string | ArrayBuffer | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) return alert("Image must be under 500KB");
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const upsert = async (
    collectionName: string,
    data: Record<string, unknown>,
    id: string | null = null
  ): Promise<string | false> => {
    const { db } = firebaseRefs.current;
    if (!user || !db) return false;
    try {
      const coll = collection(db, 'users', user.uid, collectionName);
      if (id) {
        await updateDoc(doc(coll, id), data);
        return id;
      }
      const ref = await addDoc(coll, data);
      return ref.id;
    } catch (err) {
      alert('Database error. Action failed.');
      return false;
    }
  };

  const remove = async (collectionName: string, id: string) => {
    const { db } = firebaseRefs.current;
    if (!user || !db || !confirm("Delete permanently?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
    } catch (err) { console.error(err); }
  };

  // --- 5. Date & Search Filtering ---
  const filteredDonations = useMemo(() => {
    if (!selectedOrg) return [];
    return allDonations
      .filter(d => d.orgId === selectedOrg.id)
      .filter(d => {
        const donor = masterDonors.find(m => m.id === d.donorId);
        const matchesSearch = !searchTerm || 
          donor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
          donor?.pan?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const donationDate = new Date(d.date);
        const matchesStart = !startDate || donationDate >= new Date(startDate);
        const matchesEnd = !endDate || donationDate <= new Date(endDate);
        
        return matchesSearch && matchesStart && matchesEnd;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allDonations, selectedOrg, masterDonors, searchTerm, startDate, endDate]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div></div>;

  // --- 6. Security Screen ---
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6 font-sans">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-gold/20">
          <div className="bg-brand-navy p-10 text-white text-center">
            <img src={BRAND.logo} alt="Lata Agrawal Foundation" className="h-20 w-20 object-contain mx-auto mb-5 rounded-2xl bg-brand-cream p-2" />
            <h1 className="text-2xl font-black tracking-tight">80G Receipt Manager</h1>
            <p className="text-brand-gold/90 mt-2 uppercase text-[10px] font-bold tracking-widest">Lata Agrawal Foundation</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
              <input required name="email" type="email" placeholder="admin@agrawalfoundation.org" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-brand-gold outline-none font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
              <input required name="password" type="password" placeholder="••••••••" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-brand-gold outline-none font-bold" />
            </div>
            {loginError && <p className="text-red-500 text-center font-bold text-xs bg-red-50 p-3 rounded-xl">{loginError}</p>}
            <button className="w-full bg-brand-navy text-white py-5 rounded-2xl font-black text-xl hover:bg-brand-navy/90 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" /> Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream/40 text-brand-navy font-sans flex flex-col">
      {activeReceiptData && selectedOrg && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[-10000px] top-0 opacity-0"
        >
          <div ref={receiptCaptureRef} id="receipt-capture">
            <ReceiptCertificate
              org={selectedOrg}
              donor={activeReceiptData.donor}
              donation={activeReceiptData.donation}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-white border-b border-brand-gold/20 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={goToDashboard}>
            <img src={BRAND.logo} alt="Lata Agrawal Foundation" className="h-10 w-10 object-contain rounded-lg" />
            <div className="hidden sm:block">
              <span className="font-black text-lg tracking-tight block leading-tight">Lata Agrawal Foundation</span>
              <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">80G Receipt Manager</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={goToDashboard} className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${currentView === VIEWS.DASHBOARD ? 'bg-brand-navy text-white' : 'hover:bg-brand-cream text-slate-600'}`}>
              <LayoutDashboard size={16} /> Home
            </button>
            <button onClick={() => setCurrentView(VIEWS.DONORS)} className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${currentView === VIEWS.DONORS ? 'bg-brand-navy text-white' : 'hover:bg-brand-cream text-slate-600'}`}>
              <Users size={16} /> Donors
            </button>
            <button onClick={() => setCurrentView(VIEWS.ALL_RECEIPTS)} className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${currentView === VIEWS.ALL_RECEIPTS ? 'bg-brand-navy text-white' : 'hover:bg-brand-cream text-slate-600'}`}>
              <FileText size={16} /> Receipts
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 flex-grow w-full print:hidden">
        {currentView === VIEWS.DASHBOARD && (
          <div className="space-y-8 animate-in fade-in">
            <div className="bg-brand-navy text-white rounded-[2rem] px-8 py-6 flex flex-wrap items-center justify-between gap-4 shadow-lg">
              <div>
                <p className="text-brand-gold text-[10px] font-black uppercase tracking-widest">{currentFinancialYear()} Summary</p>
                <p className="text-2xl font-black mt-1">₹{stats.fyAmount.toLocaleString('en-IN')}</p>
                <p className="text-white/70 text-sm mt-1">{stats.fyCount} donations this financial year</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">All-time collection</p>
                <p className="text-xl font-black text-brand-gold">₹{stats.totalAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Foundations', val: stats.orgs, icon: Building2, color: 'text-brand-navy', bg: 'bg-brand-cream', onClick: goToDashboard },
                { label: 'Unique Donors', val: stats.donors, icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50', onClick: () => setCurrentView(VIEWS.DONORS) },
                { label: 'Total Receipts', val: stats.donationsCount, icon: FileText, color: 'text-purple-700', bg: 'bg-purple-50', onClick: () => setCurrentView(VIEWS.ALL_RECEIPTS) },
                { label: 'Collection', val: `₹${stats.totalAmount.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-brand-gold', bg: 'bg-amber-50', onClick: () => setCurrentView(VIEWS.ALL_RECEIPTS) },
              ].map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={s.onClick}
                  className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left hover:shadow-lg hover:border-brand-gold/40 hover:-translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className={`${s.bg} ${s.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}><s.icon size={20} /></div>
                  <div className="text-2xl font-black">{s.val}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</div>
                  <div className="text-[9px] font-bold text-brand-gold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View details →</div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Organizations</h2>
                <p className="text-slate-500 font-medium">Entities authorized to issue tax-exempt receipts.</p>
              </div>
              <button onClick={() => { setEditingItem(null); setIsOrgModalOpen(true); }} className="bg-brand-navy hover:bg-brand-navy/90 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black shadow-xl"><Plus size={20} /> Add Foundation</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizations.map(org => (
                <div key={org.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
                  <div className="bg-brand-cream w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-navy group-hover:text-white transition-colors text-brand-navy"><Building2 className="w-8 h-8" /></div>
                  <h3 className="font-black text-2xl mb-2 line-clamp-1">{org.name}</h3>
                  <div className="space-y-2 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-grow text-[10px] font-black">
                    <div className="flex justify-between text-slate-400 uppercase"><span>PAN</span><span className="text-blue-600 font-mono font-bold uppercase">{org.pan}</span></div>
                    <div className="flex justify-between text-slate-400 uppercase"><span>80G ID</span><span className="text-slate-700">{org.regNo}</span></div>
                    {org.signatureBase64 && <div className="flex justify-between items-center pt-2 border-t mt-2 text-emerald-600"><span className="text-slate-400">SIGNATURE</span><ShieldCheck size={14} /></div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openLedger(org)} className="flex-grow py-4 bg-brand-navy text-white rounded-2xl text-sm font-black hover:bg-brand-gold hover:text-brand-navy transition-all flex items-center justify-center gap-2">Open Ledger <ChevronRight size={18} /></button>
                    <button onClick={() => { setEditingItem(org); setIsOrgModalOpen(true); }} className="p-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600"><Edit2 size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === VIEWS.DONORS && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button onClick={goToDashboard} className="p-3 bg-white border border-slate-200 rounded-xl"><X size={20} className="text-slate-400" /></button>
                  <h1 className="text-4xl font-black tracking-tight">Master Donors</h1>
                </div>
                <button onClick={() => { setEditingItem(null); setDonorModalAfterSave(null); setIsDonorModalOpen(true); }} className="bg-brand-navy text-white px-8 py-4 rounded-2xl font-black shadow-xl"><UserPlus size={20} /> New Profile</button>
             </div>
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                    <tr><th className="px-10 py-6">Name</th><th className="px-10 py-6">PAN</th><th className="px-10 py-6">Contact Details</th><th className="px-10 py-6 text-center">Manage</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterDonors.map(donor => (
                      <tr key={donor.id} className="hover:bg-blue-50/10 transition-colors">
                        <td className="px-10 py-8 font-black text-xl">{donor.name}</td>
                        <td className="px-10 py-8 font-mono font-bold text-blue-600 uppercase">{donor.pan}</td>
                        <td className="px-10 py-8 text-sm text-slate-500">
                          <div>{donor.email}</div>
                          <div className="text-xs">{donor.phone}</div>
                        </td>
                        <td className="px-10 py-8 flex justify-center gap-3">
                          <button onClick={() => { setEditingItem(donor); setIsDonorModalOpen(true); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Edit2 size={18}/></button>
                          <button onClick={() => remove('donors', donor.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {currentView === VIEWS.ALL_RECEIPTS && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <button onClick={goToDashboard} className="p-3 bg-white border border-slate-200 rounded-xl"><X size={20} className="text-slate-400" /></button>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight">All Receipts</h1>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    {allReceiptsFiltered.length} records · ₹{allReceiptsFiltered.reduce((s, d) => s + d.amount, 0).toLocaleString('en-IN')} filtered total
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search donor, PAN, or foundation..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold/30 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                  <tr><th className="px-8 py-6">Foundation</th><th className="px-8 py-6">Donor</th><th className="px-8 py-6 text-right">Amount</th><th className="px-8 py-6">Date</th><th className="px-8 py-6 text-center">Email</th><th className="px-8 py-6 text-center">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allReceiptsFiltered.map((dn) => {
                    const d = masterDonors.find((m) => m.id === dn.donorId);
                    const org = getOrgForDonation(dn);
                    return (
                      <tr key={dn.id} className="hover:bg-brand-cream/30">
                        <td className="px-8 py-6 font-bold text-sm">{org?.name || '—'}</td>
                        <td className="px-8 py-6">
                          <div className="font-black">{d?.name || 'Unknown'}</div>
                          <div className="text-[10px] font-mono text-brand-navy">{d?.pan}</div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-xl">₹{dn.amount.toLocaleString('en-IN')}</td>
                        <td className="px-8 py-6 text-sm font-bold">{formatDateDDMMYYYY(dn.date)}</td>
                        <td className="px-8 py-6 text-center">
                          {dn.emailSentAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                              <CheckCircle2 size={12} /> {formatSentAt(dn.emailSentAt)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">Not sent</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center gap-2">
                            <button type="button" disabled={isPdfGenerating} onClick={() => { if (!d) return; const o = getOrgForDonation(dn); if (!o) return; setSelectedOrg(o); downloadReceiptFromLedger(d, dn); }} className="px-3 py-2 bg-brand-navy text-white rounded-xl text-[10px] font-black flex items-center gap-1 disabled:opacity-60"><Download size={12} /> PDF</button>
                            <button type="button" onClick={() => { if (!d) return; const o = getOrgForDonation(dn); if (!o) return; setSelectedOrg(o); openReceiptPreview(d, dn); }} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600" title="Preview"><Eye size={16} /></button>
                            <button type="button" onClick={() => { if (!d) return; const o = getOrgForDonation(dn); if (!o) return; setSelectedOrg(o); openEmailModal(d, dn); }} className="p-2 hover:bg-emerald-50 rounded-xl text-emerald-600" title="Email"><Mail size={16} /></button>
                            {org && (
                              <button type="button" onClick={() => openLedger(org)} className="p-2 hover:bg-brand-cream rounded-xl text-brand-navy" title="Open ledger"><ChevronRight size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allReceiptsFiltered.length === 0 && (
                    <tr><td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-bold">No receipts match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === VIEWS.LEDGER && selectedOrg && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <button onClick={goToDashboard} className="p-4 bg-white border border-slate-200 rounded-2xl"><X size={24} className="text-slate-400" /></button>
                <h1 className="text-3xl md:text-4xl font-black">{selectedOrg.name}</h1>
              </div>
              <button onClick={() => { setEditingItem(null); setDonationDonorId(''); setIsDonationModalOpen(true); }} className="bg-brand-navy text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-brand-navy/90"><Plus size={20} /> Record Donation</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search by name or PAN..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                    <tr><th className="px-10 py-6">Donor</th><th className="px-10 py-6 text-right">Amount</th><th className="px-10 py-6">Date</th><th className="px-10 py-6 text-center">80G Receipt</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDonations.map(dn => {
                      const d = masterDonors.find(m => m.id === dn.donorId);
                      return (
                        <tr key={dn.id} className="hover:bg-blue-50/10">
                          <td className="px-10 py-8">
                            <div className="font-black text-slate-900 text-lg">{d?.name || 'Unknown'}</div>
                            <div className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block uppercase">{d?.pan}</div>
                          </td>
                          <td className="px-10 py-8 text-right font-black text-2xl">₹{dn.amount.toLocaleString('en-IN')}</td>
                          <td className="px-10 py-8">
                            <div className="text-sm font-bold">{formatDateDDMMYYYY(dn.date)}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">{dn.paymentMode}</div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex justify-center gap-3">
                                <button
                                  type="button"
                                  disabled={isPdfGenerating}
                                  onClick={() => downloadReceiptFromLedger(d, dn)}
                                  className="px-4 py-2 bg-brand-navy text-white rounded-xl text-xs font-black flex items-center gap-2 hover:bg-brand-gold hover:text-brand-navy transition-colors disabled:opacity-60"
                                >
                                  <Download size={14} /> {isPdfGenerating ? 'Saving…' : 'Download'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReceiptPreview(d, dn)}
                                  className="p-3 hover:bg-slate-100 rounded-xl text-slate-600"
                                  title="Preview receipt"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEmailModal(d, dn)}
                                  className="p-3 hover:bg-emerald-50 rounded-xl text-emerald-600"
                                  title="Email receipt to donor"
                                >
                                  <Mail size={18} />
                                </button>
                                <button onClick={() => remove('donations', dn.id)} className="p-3 hover:bg-red-50 rounded-xl text-red-400"><Trash2 size={16}/></button>
                              </div>
                              {dn.emailSentAt && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 size={12} /> Emailed {formatSentAt(dn.emailSentAt)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-brand-navy text-white p-4 text-[10px] flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div className="flex gap-4 items-center flex-wrap">
          <img src={BRAND.logo} alt="" className="h-6 w-6 object-contain rounded opacity-90" />
          <div className="flex items-center gap-2 text-white/50"><Fingerprint size={12} /> ID: <span className="font-mono text-white/90 tracking-tighter">{user?.uid?.slice(0,12)}</span></div>
          <div className="flex items-center gap-2 text-white/50"><Database size={12} /> <span className="text-brand-gold font-bold uppercase">Cloud Active</span></div>
        </div>
        <div className="text-white/40 font-black tracking-widest uppercase">Lata Agrawal Foundation · 80G</div>
      </footer>

      {/* MODALS */}
      {isReceiptModalOpen && activeReceiptData && selectedOrg && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-xl overflow-y-auto"
          onClick={() => setIsReceiptModalOpen(false)}
        >
          <div className="min-h-full flex flex-col items-center px-4 py-6 md:py-10" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-4xl flex flex-wrap justify-end gap-2 mb-4 sticky top-2 z-10">
              <button
                type="button"
                disabled={isPdfGenerating}
                onClick={() => runReceiptPdfAction('download')}
                className="bg-white px-5 py-2.5 rounded-full font-black shadow-lg flex items-center gap-2 text-slate-900 text-sm hover:bg-slate-100 disabled:opacity-60"
              >
                <Download size={18} /> {isPdfGenerating ? 'Generating…' : 'Download PDF'}
              </button>
              <button
                type="button"
                disabled={isPdfGenerating}
                onClick={() => runReceiptPdfAction('open')}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-black shadow-lg flex items-center gap-2 text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <ExternalLink size={18} /> Open in New Tab
              </button>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="bg-white/10 p-2.5 rounded-full text-white hover:bg-white/20"
                aria-label="Close preview"
              >
                <X size={24} />
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 overflow-x-auto max-w-full">
              <ReceiptCertificate
                org={selectedOrg}
                donor={activeReceiptData.donor}
                donation={activeReceiptData.donation}
              />
            </div>
          </div>
        </div>
      )}

      {isDonorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const data = Object.fromEntries(fd);
              const result = await upsert('donors', data, editingItem?.id ?? null);
              if (result) {
                if (donorModalAfterSave) {
                  donorModalAfterSave(result);
                  setDonorModalAfterSave(null);
                }
                setIsDonorModalOpen(false);
                setEditingItem(null);
              }
            }} className="p-10 space-y-8">
              <h2 className="text-3xl font-black">{editingItem ? 'Update' : 'Add'} Donor Profile</h2>
              <div className="space-y-6">
                <input required name="name" defaultValue={editingItem?.name} placeholder="Donor Full Name" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <input required name="pan" defaultValue={editingItem?.pan} placeholder="Donor PAN" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl uppercase font-mono font-bold" maxLength={10} />
                  <input name="phone" defaultValue={editingItem?.phone} placeholder="Phone Number" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold" />
                </div>
                <input type="email" required name="email" defaultValue={editingItem?.email} placeholder="Email Address" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold" />
                <textarea required name="address" defaultValue={editingItem?.address} placeholder="Donor Address" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl h-24 font-medium resize-none focus:border-blue-500 outline-none" />
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => { setIsDonorModalOpen(false); setDonorModalAfterSave(null); setEditingItem(null); }} className="flex-1 py-5 border-2 rounded-3xl font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-brand-navy text-white rounded-3xl font-black shadow-xl">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDonationModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => { 
              e.preventDefault(); 
              const fd = new FormData(e.currentTarget); 
              const amountStr = fd.get('amount') as string;
              const donorId = donationDonorId || (fd.get('donorId') as string);
              if (!donorId) { alert('Please select or add a donor.'); return; }
              const data = {
                donorId,
                date: fd.get('date'),
                paymentMode: fd.get('paymentMode'),
                refNo: fd.get('refNo') || '',
                amount: parseFloat(amountStr),
                orgId: selectedOrg.id,
              }; 
              if (await upsert('donations', data)) {
                setIsDonationModalOpen(false);
                setDonationDonorId('');
              }
            }} className="p-10 space-y-8">
              <h2 className="text-3xl font-black">Record Donation</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Donor</label>
                  <div className="flex gap-2">
                    <DonorSearchSelect
                      donors={masterDonors}
                      value={donationDonorId}
                      onChange={setDonationDonorId}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDonorModalFromDonation();
                      }}
                      className="px-4 py-4 bg-brand-cream border-2 border-brand-gold/30 rounded-2xl text-brand-navy font-black text-xs hover:bg-brand-gold/20 flex items-center gap-1 shrink-0"
                      title="Add new donor"
                    >
                      <UserPlus size={18} /> New
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (INR)</label>
                     <input required type="number" name="amount" placeholder="₹" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-black text-blue-600 outline-none" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                     <input required type="date" name="date" defaultValue={todayInputDateValue()} className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold outline-none" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Mode</label>
                    <select required name="paymentMode" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold bg-white">
                      {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UTR / Ref No.</label>
                    <input name="refNo" placeholder="Optional" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold uppercase outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsDonationModalOpen(false)} className="flex-1 py-5 border-2 rounded-3xl font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-brand-navy text-white rounded-3xl font-black shadow-xl">Confirm Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOrgModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = {...Object.fromEntries(fd), signatureBase64: editingItem?.signatureBase64}; if(await upsert('organizations', data, editingItem?.id)) setIsOrgModalOpen(false); }} className="p-10 space-y-8">
              <h2 className="text-3xl font-black tracking-tight">{editingItem ? 'Update' : 'Add'} Foundation</h2>
              <div className="space-y-6">
                <input required name="name" defaultValue={editingItem?.name} placeholder="Official Name" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl outline-none font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <input required name="pan" defaultValue={editingItem?.pan} placeholder="PAN Number" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl uppercase font-mono font-bold" maxLength={10} />
                  <input required name="regNo" defaultValue={editingItem?.regNo} placeholder="80G Reg Number" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold" />
                </div>
                <textarea required name="address" defaultValue={editingItem?.address} placeholder="Office Address" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl h-24 font-medium resize-none focus:border-blue-500 outline-none" />
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Authorized Signature</label>
                  <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    {editingItem?.signatureBase64 ? (
                      <div className="relative group">
                        <img src={editingItem.signatureBase64} className="h-16 w-32 object-contain bg-white rounded border" alt="Signature" />
                        <button type="button" onClick={() => setEditingItem((prev: any) => ({...prev, signatureBase64: null}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><X size={12}/></button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full py-4 text-slate-400">
                        <ImageIcon className="mb-2" size={24} />
                        <input type="file" accept="image/*" className="hidden" id="sig-upload" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem((prev: any) => ({...prev, signatureBase64: base64})))} />
                        <label htmlFor="sig-upload" className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">Upload Signature</label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsOrgModalOpen(false)} className="flex-1 py-5 border-2 rounded-3xl font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black shadow-xl">Complete Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEmailModalOpen && activeReceiptData && selectedOrg && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="bg-slate-900 p-10 text-white text-center relative">
              <button type="button" onClick={() => setIsEmailModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
              <img src="/lata-agrawal-foundation-logo.png" alt="Lata Agrawal Foundation" className="h-16 w-16 object-contain mx-auto mb-4 rounded-lg bg-[#f7f4ed] p-1" />
              <h2 className="text-2xl font-black">Email Receipt to Donor</h2>
              <p className="text-slate-400 font-medium mt-2 text-sm">{activeReceiptData.donor?.name || 'Donor'}</p>
              <p className="text-blue-300 font-mono text-xs mt-1">{activeReceiptData.donor?.email || 'No email on file'}</p>
            </div>
            <div className="p-8 space-y-6">
              {emailSendSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl text-center text-sm font-medium">
                  Receipt sent to {activeReceiptData.donor?.email} at {formatSentAt(new Date().toISOString())}
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                    <p>Sends a thank-you email with the <strong>80G certificate PDF</strong> attached.</p>
                    <p className="mt-3 text-xs text-slate-400">Amount: ₹{activeReceiptData.donation.amount.toLocaleString('en-IN')} · {selectedOrg.name}</p>
                  </div>
                  {emailSendError && <p className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-medium">{emailSendError}</p>}
                  <button type="button" disabled={isEmailSending || !activeReceiptData.donor?.email} onClick={() => void handleSendReceiptEmail()} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                    <Mail size={22} /> {isEmailSending ? 'Sending…' : 'Send receipt with PDF'}
                  </button>
                </>
              )}
              <button type="button" onClick={() => setIsEmailModalOpen(false)} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600">{emailSendSuccess ? 'Close' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
