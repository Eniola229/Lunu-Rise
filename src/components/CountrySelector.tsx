import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Country {
  code: string;
  name: string;
  flag: string;
}

const countries: Country[] = [
  // Alphabetical order - all countries mixed together
  { code: 'AF', name: 'Afghanistan (+93)', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania (+355)', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria (+213)', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina (+54)', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia (+61)', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria (+43)', flag: '🇦🇹' },
  { code: 'BH', name: 'Bahrain (+973)', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh (+880)', flag: '🇧🇩' },
  { code: 'BB', name: 'Barbados (+1)', flag: '🇧🇧' },
  { code: 'BY', name: 'Belarus (+375)', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium (+32)', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize (+501)', flag: '🇧🇿' },
  { code: 'BT', name: 'Bhutan (+975)', flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia (+591)', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia (+387)', flag: '🇧🇦' },
  { code: 'BW', name: 'Botswana (+267)', flag: '🇧🇼' },
  { code: 'BR', name: 'Brazil (+55)', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria (+359)', flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso (+226)', flag: '🇧🇫' },
  { code: 'KH', name: 'Cambodia (+855)', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon (+237)', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada (+1)', flag: '🇨🇦' },
  { code: 'TD', name: 'Chad (+235)', flag: '🇹🇩' },
  { code: 'CL', name: 'Chile (+56)', flag: '🇨🇱' },
  { code: 'CN', name: 'China (+86)', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia (+57)', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica (+506)', flag: '🇨🇷' },
  { code: 'HR', name: 'Croatia (+385)', flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba (+53)', flag: '🇨🇺' },
  { code: 'CY', name: 'Cyprus (+357)', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic (+420)', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark (+45)', flag: '🇩🇰' },
  { code: 'DO', name: 'Dominican Republic (+1)', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador (+593)', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt (+20)', flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador (+503)', flag: '🇸🇻' },
  { code: 'EE', name: 'Estonia (+372)', flag: '🇪🇪' },
  { code: 'SZ', name: 'Eswatini (+268)', flag: '🇸🇿' },
  { code: 'ET', name: 'Ethiopia (+251)', flag: '🇪🇹' },
  { code: 'FJ', name: 'Fiji (+679)', flag: '🇫🇯' },
  { code: 'FI', name: 'Finland (+358)', flag: '🇫🇮' },
  { code: 'FR', name: 'France (+33)', flag: '🇫🇷' },
  { code: 'GF', name: 'French Guiana (+594)', flag: '🇬🇫' },
  { code: 'PF', name: 'French Polynesia (+689)', flag: '🇵🇫' },
  { code: 'DE', name: 'Germany (+49)', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana (+233)', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece (+30)', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala (+502)', flag: '🇬🇹' },
  { code: 'GY', name: 'Guyana (+592)', flag: '🇬🇾' },
  { code: 'HT', name: 'Haiti (+509)', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras (+504)', flag: '🇭🇳' },
  { code: 'HU', name: 'Hungary (+36)', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland (+354)', flag: '🇮🇸' },
  { code: 'IN', name: 'India (+91)', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia (+62)', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran (+98)', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq (+964)', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland (+353)', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel (+972)', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy (+39)', flag: '🇮🇹' },
  { code: 'CI', name: 'Ivory Coast (+225)', flag: '🇨🇮' },
  { code: 'JM', name: 'Jamaica (+1)', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan (+81)', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan (+962)', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan (+7)', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya (+254)', flag: '🇰🇪' },
  { code: 'KI', name: 'Kiribati (+686)', flag: '🇰🇮' },
  { code: 'KW', name: 'Kuwait (+965)', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan (+996)', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos (+856)', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia (+371)', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon (+961)', flag: '🇱🇧' },
  { code: 'LS', name: 'Lesotho (+266)', flag: '🇱🇸' },
  { code: 'LT', name: 'Lithuania (+370)', flag: '🇱🇹' },
  { code: 'MG', name: 'Madagascar (+261)', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi (+265)', flag: '🇲🇼' },
  { code: 'MY', name: 'Malaysia (+60)', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives (+960)', flag: '🇲🇻' },
  { code: 'ML', name: 'Mali (+223)', flag: '🇲🇱' },
  { code: 'MT', name: 'Malta (+356)', flag: '🇲🇹' },
  { code: 'MH', name: 'Marshall Islands (+692)', flag: '🇲🇭' },
  { code: 'MU', name: 'Mauritius (+230)', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico (+52)', flag: '🇲🇽' },
  { code: 'FM', name: 'Micronesia (+691)', flag: '🇫🇲' },
  { code: 'MD', name: 'Moldova (+373)', flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia (+976)', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro (+382)', flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco (+212)', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique (+258)', flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar (+95)', flag: '🇲🇲' },
  { code: 'NA', name: 'Namibia (+264)', flag: '🇳🇦' },
  { code: 'NR', name: 'Nauru (+674)', flag: '🇳🇷' },
  { code: 'NP', name: 'Nepal (+977)', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands (+31)', flag: '🇳🇱' },
  { code: 'NC', name: 'New Caledonia (+687)', flag: '🇳🇨' },
  { code: 'NZ', name: 'New Zealand (+64)', flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua (+505)', flag: '🇳🇮' },
  { code: 'NE', name: 'Niger (+227)', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria (+234)', flag: '🇳🇬' },
  { code: 'MK', name: 'North Macedonia (+389)', flag: '🇲🇰' },
  { code: 'NO', name: 'Norway (+47)', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman (+968)', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan (+92)', flag: '🇵🇰' },
  { code: 'PW', name: 'Palau (+680)', flag: '🇵🇼' },
  { code: 'PS', name: 'Palestine (+970)', flag: '🇵🇸' },
  { code: 'PA', name: 'Panama (+507)', flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea (+675)', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay (+595)', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru (+51)', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines (+63)', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland (+48)', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal (+351)', flag: '🇵🇹' },
  { code: 'PR', name: 'Puerto Rico (+1)', flag: '🇵🇷' },
  { code: 'QA', name: 'Qatar (+974)', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania (+40)', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia (+7)', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda (+250)', flag: '🇷🇼' },
  { code: 'WS', name: 'Samoa (+685)', flag: '🇼🇸' },
  { code: 'SA', name: 'Saudi Arabia (+966)', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal (+221)', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia (+381)', flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles (+248)', flag: '🇸🇨' },
  { code: 'SG', name: 'Singapore (+65)', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia (+421)', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia (+386)', flag: '🇸🇮' },
  { code: 'SB', name: 'Solomon Islands (+677)', flag: '🇸🇧' },
  { code: 'ZA', name: 'South Africa (+27)', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea (+82)', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain (+34)', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka (+94)', flag: '🇱🇰' },
  { code: 'SR', name: 'Suriname (+597)', flag: '🇸🇷' },
  { code: 'SE', name: 'Sweden (+46)', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland (+41)', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria (+963)', flag: '🇸🇾' },
  { code: 'TJ', name: 'Tajikistan (+992)', flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania (+255)', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand (+66)', flag: '🇹🇭' },
  { code: 'TO', name: 'Tonga (+676)', flag: '🇹🇴' },
  { code: 'TT', name: 'Trinidad & Tobago (+1)', flag: '🇹🇹' },
  { code: 'TN', name: 'Tunisia (+216)', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey (+90)', flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan (+993)', flag: '🇹🇲' },
  { code: 'TV', name: 'Tuvalu (+688)', flag: '🇹🇻' },
  { code: 'AE', name: 'UAE (+971)', flag: '🇦🇪' },
  { code: 'UG', name: 'Uganda (+256)', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine (+380)', flag: '🇺🇦' },
  { code: 'GB', name: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: 'US', name: 'United States (+1)', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay (+598)', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan (+998)', flag: '🇺🇿' },
  { code: 'VU', name: 'Vanuatu (+678)', flag: '🇻🇺' },
  { code: 'VE', name: 'Venezuela (+58)', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam (+84)', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen (+967)', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia (+260)', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe (+263)', flag: '🇿🇼' },
  
  { code: 'OTHER', name: 'Other countries', flag: '🌍' }
];

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const CountrySelector = ({ value, onValueChange, disabled }: CountrySelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCountry = countries.find(c => c.code === value);
  
  // Filter countries based on search query
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (countryCode: string) => {
    onValueChange(countryCode);
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal h-12 bg-background z-50"
          disabled={disabled}
        >
          {selectedCountry ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedCountry.flag}</span>
              <span>{selectedCountry.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select your country</span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-background z-50">
        <DialogHeader>
          <DialogTitle className="text-center">Select your country</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredCountries.map((country) => (
            <button
              key={country.code}
              onClick={() => handleSelect(country.code)}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors bg-background"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                  {value === country.code && (
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                  )}
                </div>
                <span className="text-2xl">{country.flag}</span>
                <span className="font-medium">{country.name}</span>
              </div>
              {value === country.code && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button 
            onClick={() => setOpen(false)}
            className="px-8"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { CountrySelector };
export default CountrySelector;