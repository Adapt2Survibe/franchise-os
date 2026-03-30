export interface BrokerProfile {
  fullName: string;
  email: string;
  phone: string;
  networkOrIndependent: string;
  about: string;
  unitsSold: number;
  preferredContact: ('phone' | 'text' | 'email')[];
  businessName: string;
  businessWebsite: string;
  calendarLink: string;
  paymentPreference: 'wire' | 'direct_deposit' | 'paypal';
}

export interface BrokerLead {
  id: string;
  candidateName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  liquidCapital: number;
  netWorth: number;
  budget: number;
  categoryInterests: string[];
  brandSubmittedTo: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  submittedAt: string;
}

export type ContactMethod = 'phone' | 'text' | 'email';

export type PaymentMethod = 'wire' | 'direct_deposit' | 'paypal';

export const PIPELINE_COLUMNS = [
  { key: 'new' as const,       label: 'New',       dot: 'bg-blue-400' },
  { key: 'contacted' as const, label: 'Contacted', dot: 'bg-amber-400' },
  { key: 'qualified' as const, label: 'Qualified', dot: 'bg-purple-400' },
  { key: 'converted' as const, label: 'Converted', dot: 'bg-green-400' },
  { key: 'lost' as const,      label: 'Lost',      dot: 'bg-red-400' },
];

export const CATEGORY_OPTIONS = [
  'Food & Beverage',
  'Fitness & Wellness',
  'Education & Tutoring',
  'Home Services',
  'Automotive',
  'Health & Beauty',
  'Pet Services',
  'Cleaning & Restoration',
  'Senior Care',
  'Business Services',
];

export const PLACEHOLDER_BRANDS = [
  'Dumpster Fire Pizza Co.',
  'Questionable Choices Daycare',
  'Shady Acres Senior Living',
  'Barely Legal Seafood',
  'Trust Me Bro Financial',
  'Sketchy Steve\'s Auto Body',
  'Oops! All Carbs Bakery',
  'The Unhinged Barber',
  'Regrettable Tattoos Inc.',
  'Who Approved This? Burgers',
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export const BROKER_NETWORKS = [
  'FranNet',
  'The Franchise Consulting Company',
  'IFPG (International Franchise Professionals Group)',
  'FranServe',
  'Franchise Brokers Association',
  'The Entrepreneur Authority',
  'Independent',
];
