import { create } from 'zustand';

const getInitialIsMobile = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

export const useAppStore = create((set) => ({
  // Navigation
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Modal / Form Dialog States
  showTransactionForm: false,
  setShowTransactionForm: (show) => set({ showTransactionForm: Boolean(show) }),
  defaultTransactionType: 'income',
  setDefaultTransactionType: (type) => set({ defaultTransactionType: type }),

  showStockForm: false,
  setShowStockForm: (show) => set({ showStockForm: Boolean(show) }),

  // Selected Entities
  selectedTransaction: null,
  setSelectedTransaction: (transaction) => set({ selectedTransaction: transaction }),

  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item }),

  // Global Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: String(query) }),

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => {
      const item =
        typeof notification === 'string'
          ? { id: Date.now() + Math.random(), message: notification, type: 'info', timestamp: new Date() }
          : { id: Date.now() + Math.random(), type: 'info', timestamp: new Date(), ...notification };
      return { notifications: [item, ...state.notifications] };
    }),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),

  // Responsive state
  isMobile: getInitialIsMobile(),
  checkMobile: () =>
    set({
      isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    }),
}));

// Setup window resize listener if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    useAppStore.getState().checkMobile();
  });
}

export default useAppStore;
