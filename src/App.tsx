import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, Firestore, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { 
  Plus, Building2, UserPlus, Trash2, Edit2, ChevronRight, 
  FileText, Search, Printer, Mail, X, 
  ShieldCheck, ExternalLink, Info, Fingerprint, Lock, 
  LogOut, Users, TrendingUp, Calendar, Image as ImageIcon,
  Database
} from 'lucide-react';

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
  LEDGER: 'ledger'  
} as const;

type ViewType = typeof VIEWS[keyof typeof VIEWS];

const PAYMENT_MODES = ['Online Transfer', 'UPI', 'Cheque', 'Cash', 'Other'];

// Helper: Amount in Words (Indian Numbering System)
const numberToWords = (num: number | string): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const nStr = num.toString();
  if (nStr.length > 9) return 'Value too high';
  
  const match = ('000000000' + nStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match) return ''; 
  
  let str = '';
  // Helper to handle groups (Crore, Lakh, etc)
  const getPart = (valStr: string) => {
    const val = parseInt(valStr);
    if (val === 0) return '';
    return (a[val] || b[parseInt(valStr[0])] + ' ' + a[parseInt(valStr[1])]);
  };

  const crore = getPart(match[1]);
  const lakh = getPart(match[2]);
  const thousand = getPart(match[3]);
  const hundred = a[parseInt(match[4])];
  const tens = getPart(match[5]);

  if (crore) str += crore + 'Crore ';
  if (lakh) str += lakh + 'Lakh ';
  if (thousand) str += thousand + 'Thousand ';
  if (hundred) str += hundred + 'Hundred ';
  if (tens) str += (str !== '' ? 'and ' : '') + tens;
  
  return str.trim() + ' Only';
};

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
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const firebaseRefs = useRef<{ auth: Auth | null; db: Firestore | null }>({ auth: null, db: null });

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
    return {
      orgs: organizations.length,
      donors: masterDonors.length,
      donationsCount: allDonations.length,
      totalAmount
    };
  }, [organizations, masterDonors, allDonations]);

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

  const upsert = async (collectionName: string, data: any, id: string | null = null) => {
    const { db } = firebaseRefs.current;
    if (!user || !db) return;
    try {
      const coll = collection(db, 'users', user.uid, collectionName);
      if (id) await updateDoc(doc(coll, id), data);
      else await addDoc(coll, data);
      return true;
    } catch (err) { alert("Database error. Action failed."); return false; }
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  // --- 6. Security Screen ---
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-12 text-white text-center">
            <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl"><Lock className="w-10 h-10" /></div>
            <h1 className="text-3xl font-black">80G Manager</h1>
            <p className="text-slate-400 mt-1 uppercase text-xs font-bold tracking-widest">Lata Agrawal Foundation</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
              <input required name="email" type="email" placeholder="admin@agrawalfoundation.org" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
              <input required name="password" type="password" placeholder="••••••••" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-bold" />
            </div>
            {loginError && <p className="text-red-500 text-center font-bold text-xs bg-red-50 p-3 rounded-xl">{loginError}</p>}
            <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-700 shadow-xl transition-all active:scale-95">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
        }
      `}</style>

      {/* Header */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 print:hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setCurrentView(VIEWS.DASHBOARD); setSelectedOrg(null); }}>
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><FileText className="text-white w-5 h-5" /></div>
            <span className="font-bold text-xl tracking-tight hidden sm:block uppercase">Agrawal Foundation</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setCurrentView(VIEWS.DONORS)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currentView === VIEWS.DONORS ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
              Donor List
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 flex-grow w-full print:hidden">
        {currentView === VIEWS.DASHBOARD && (
          <div className="space-y-8 animate-in fade-in">
            {/* Dashboard Analytics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Foundations', val: stats.orgs, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Unique Donors', val: stats.donors, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Total Receipts', val: stats.donationsCount, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Collection', val: `₹${stats.totalAmount.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                  <div className={`${s.bg} ${s.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}><s.icon size={20} /></div>
                  <div className="text-2xl font-black">{s.val}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Organizations</h2>
                <p className="text-slate-500 font-medium">Entities authorized to issue tax-exempt receipts.</p>
              </div>
              <button onClick={() => { setEditingItem(null); setIsOrgModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black shadow-xl"><Plus size={20} /> Add Foundation</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizations.map(org => (
                <div key={org.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
                  <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Building2 className="w-8 h-8" /></div>
                  <h3 className="font-black text-2xl mb-2 line-clamp-1">{org.name}</h3>
                  <div className="space-y-2 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-grow text-[10px] font-black">
                    <div className="flex justify-between text-slate-400 uppercase"><span>PAN</span><span className="text-blue-600 font-mono font-bold uppercase">{org.pan}</span></div>
                    <div className="flex justify-between text-slate-400 uppercase"><span>80G ID</span><span className="text-slate-700">{org.regNo}</span></div>
                    {org.signatureBase64 && <div className="flex justify-between items-center pt-2 border-t mt-2 text-emerald-600"><span className="text-slate-400">SIGNATURE</span><ShieldCheck size={14} /></div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedOrg(org); setCurrentView(VIEWS.LEDGER); }} className="flex-grow py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-blue-600 transition-all flex items-center justify-center gap-2">Open Ledger <ChevronRight size={18} /></button>
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
                  <button onClick={() => setCurrentView(VIEWS.DASHBOARD)} className="p-3 bg-white border border-slate-200 rounded-xl"><X size={20} className="text-slate-400" /></button>
                  <h1 className="text-4xl font-black tracking-tight">Master Donors</h1>
                </div>
                <button onClick={() => { setEditingItem(null); setIsDonorModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl"><UserPlus size={20} /> New Profile</button>
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

        {currentView === VIEWS.LEDGER && selectedOrg && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <button onClick={() => { setCurrentView(VIEWS.DASHBOARD); setSelectedOrg(null); }} className="p-4 bg-white border border-slate-200 rounded-2xl"><X size={24} className="text-slate-400" /></button>
                <h1 className="text-3xl md:text-4xl font-black">{selectedOrg.name}</h1>
              </div>
              <button onClick={() => { setEditingItem(null); setIsDonationModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl"><Plus size={20} /> Record Donation</button>
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
                            <div className="text-sm font-bold">{dn.date}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">{dn.paymentMode}</div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex justify-center gap-3">
                              <button onClick={() => { setActiveReceiptData({ donor: d, donation: dn }); setIsReceiptModalOpen(true); }} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-2 hover:bg-blue-600 transition-colors"><Printer size={14} /> Download</button>
                              <button onClick={() => { setActiveReceiptData({ donor: d, donation: dn }); setIsEmailModalOpen(true); }} className="p-3 hover:bg-emerald-50 rounded-xl text-emerald-600"><Mail size={18} /></button>
                              <button onClick={() => remove('donations', dn.id)} className="p-3 hover:bg-red-50 rounded-xl text-red-400"><Trash2 size={16}/></button>
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

      <footer className="bg-slate-900 text-white p-4 text-[10px] flex justify-between items-center print:hidden">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-400"><Fingerprint size={12} /> ID: <span className="font-mono text-white tracking-tighter">{user?.uid?.slice(0,12)}</span></div>
          <div className="flex items-center gap-2 text-slate-400"><Database size={12} /> PROJECT: <span className="text-emerald-400 font-bold uppercase">Lata Agrawal Cloud Active</span></div>
        </div>
        <div className="text-slate-500 font-black tracking-widest uppercase">Secured by Agrawal Foundation</div>
      </footer>

      {/* MODALS */}
      {isReceiptModalOpen && activeReceiptData && selectedOrg && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[60] flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative print:shadow-none print:rounded-none animate-in zoom-in-95">
            <div className="absolute -top-16 right-0 flex gap-4 print:hidden">
              <button onClick={() => window.print()} className="bg-white px-8 py-3 rounded-full font-black shadow-2xl flex items-center gap-3 text-slate-900"><Printer size={22} /> Save PDF</button>
              <button onClick={() => setIsReceiptModalOpen(false)} className="bg-white/10 p-3 rounded-full text-white"><X size={28} /></button>
            </div>
            <div id="printable-receipt" className="p-16 text-slate-900 font-serif bg-white">
              <div className="border-[8px] border-slate-900 p-12 relative">
                <div className="text-center mb-16">
                  <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">{selectedOrg.name}</h2>
                  <p className="text-sm italic text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">{selectedOrg.address}</p>
                  <div className="flex justify-center gap-12 text-[10px] font-black border-y-4 border-slate-900 py-5 uppercase tracking-[0.3em]">
                    <span>PAN: {selectedOrg.pan}</span>
                    <span>80G REG: {selectedOrg.regNo}</span>
                  </div>
                </div>
                <div className="flex justify-between items-start mb-16 font-sans">
                  <div className="bg-slate-900 text-white px-10 py-4 font-black tracking-widest uppercase text-xs">Donation Receipt</div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-slate-300">Receipt ID: <span className="text-slate-900 font-mono">80G-{activeReceiptData.donation.id.slice(-8).toUpperCase()}</span></p>
                    <p className="text-[10px] uppercase font-black text-slate-300 mt-2">Date: <span className="text-slate-900 font-bold">{activeReceiptData.donation.date}</span></p>
                  </div>
                </div>
                <div className="space-y-10 text-2xl leading-[1.6] mb-20 text-slate-800">
                  <p>Received with thanks from <strong>{activeReceiptData.donor?.name || 'Unknown'}</strong> (PAN: <span className="font-mono font-black">{activeReceiptData.donor?.pan || 'N/A'}</span>)</p>
                  <p>A sum of <strong>INR {activeReceiptData.donation.amount.toLocaleString('en-IN')}/-</strong></p>
                  <div className="bg-slate-50 p-6 rounded-2xl border-l-8 border-slate-900 font-sans">
                    <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Amount in Words</p>
                    <p className="font-black text-2xl uppercase">{numberToWords(activeReceiptData.donation.amount)}</p>
                  </div>
                  <p>Via <strong>{activeReceiptData.donation.paymentMode}</strong> {activeReceiptData.donation.refNo && <span className="text-slate-400">(Ref: {activeReceiptData.donation.refNo})</span>}.</p>
                </div>
                <div className="flex justify-between items-end font-sans">
                  <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest max-w-xs leading-relaxed">Generated electronically. This certificate is valid for tax exemption under IT Act. Hash: {activeReceiptData.donation.id.slice(0,16)}</div>
                  <div className="text-right">
                    <p className="text-sm font-black mb-4">For {selectedOrg.name}</p>
                    {selectedOrg.signatureBase64 && <img src={selectedOrg.signatureBase64} className="h-16 w-40 object-contain mx-auto mb-2" alt="Signature" />}
                    <div className="h-1 w-64 bg-slate-900 mb-3"></div>
                    <p className="text-[10px] uppercase font-black tracking-widest">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDonorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <form onSubmit={async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = Object.fromEntries(fd); if(await upsert('donors', data, editingItem?.id)) setIsDonorModalOpen(false); }} className="p-10 space-y-8">
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
                <button type="button" onClick={() => setIsDonorModalOpen(false)} className="flex-1 py-5 border-2 rounded-3xl font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black shadow-xl">Save Record</button>
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
              const data = {
                ...Object.fromEntries(fd),
                amount: parseFloat(amountStr),
                orgId: selectedOrg.id
              }; 
              if(await upsert('donations', data)) setIsDonationModalOpen(false); 
            }} className="p-10 space-y-8">
              <h2 className="text-3xl font-black">Record Donation</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Donor</label>
                  <select required name="donorId" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold outline-none bg-white">
                    <option value="">-- Choose Donor --</option>
                    {masterDonors.map(m => <option key={m.id} value={m.id}>{m.name} ({m.pan})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (INR)</label>
                     <input required type="number" name="amount" placeholder="₹" className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-black text-blue-600 outline-none" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                     <input required type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold outline-none" />
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
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black shadow-xl">Confirm Transaction</button>
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
            <div className="bg-slate-900 p-12 text-white text-center relative">
              <button onClick={() => setIsEmailModalOpen(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
              <Mail className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-3xl font-black">Email Receipt</h2>
              <p className="text-slate-400 font-bold mt-2 text-sm">{activeReceiptData.donor?.email || 'N/A'}</p>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex gap-4 text-blue-800 text-[11px] font-medium leading-relaxed">
                <Info size={24} className="shrink-0 text-blue-600" />
                <div>
                  <strong>Steps to Send:</strong>
                  <ol className="list-decimal ml-4 mt-2">
                    <li>Open the receipt and save it as a PDF.</li>
                    <li>Click below to draft the email automatically.</li>
                    <li>Attach the PDF manually in your mail app.</li>
                  </ol>
                </div>
              </div>
              <button onClick={() => {
                if (!activeReceiptData.donor) return;
                const subject = encodeURIComponent(`80G Receipt - ${selectedOrg.name}`);
                const body = encodeURIComponent(`Dear ${activeReceiptData.donor.name},\n\nThank you for your generous contribution of ₹${activeReceiptData.donation.amount.toLocaleString('en-IN')}.\n\nPlease find attached your 80G tax certificate.\n\nWarm regards,\n${selectedOrg.name}`);
                const mailtoUrl = `mailto:${activeReceiptData.donor.email}?subject=${subject}&body=${body}`;
                window.open(mailtoUrl, '_blank');
              }} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-xl hover:bg-blue-700 shadow-2xl flex items-center justify-center gap-3">
                <ExternalLink size={22} /> Create Email Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
