export type Product = {
  id: number;
  name: string;
  shortName: string;
  category: "Oliwa" | "Oliwki" | "Miody" | "Zioła";
  description: string;
  ingredients?: string;
  allergens?: string;
  origin?: string;
  price: number;
  compareAt?: number;
  unit: string;
  stock: number;
  tags: string[];
  crop: "oil" | "olives" | "honey" | "oregano";
  featured?: boolean;
  softDeleted?: boolean;
  images?: Array<{ url: string; alt: string }>;
};

export const initialProducts: Product[] = [
  {
    id: 1,
    name: "Oliwa extra virgin Koroneiki",
    shortName: "Koroneiki",
    category: "Oliwa",
    description:
      "Tłoczona na zimno w dniu zbioru. Świeża, trawiasta i delikatnie pieprzna, z naturalnie niską kwasowością.",
    price: 69,
    unit: "500 ml",
    stock: 42,
    tags: ["extra virgin", "z naszego gaju", "zbiór 2025"],
    crop: "oil",
    featured: true,
  },
  {
    id: 2,
    name: "Oliwa extra virgin Koroneiki",
    shortName: "Koroneiki rodzinna",
    category: "Oliwa",
    description:
      "Rodzinny format naszej oliwy. Do sałatek, pieczywa i codziennego gotowania w niższej temperaturze.",
    price: 119,
    unit: "1 l",
    stock: 18,
    tags: ["extra virgin", "z naszego gaju", "rodzinny format"],
    crop: "oil",
  },
  {
    id: 3,
    name: "Oliwki Kalamata w zalewie",
    shortName: "Kalamata",
    category: "Oliwki",
    description:
      "Mięsiste oliwki o głębokim, owocowym smaku. Naturalnie dojrzewające, bez sztucznych barwników.",
    price: 24.9,
    unit: "300 g",
    stock: 67,
    tags: ["Kalamata", "bez konserwantów", "wegańskie"],
    crop: "olives",
    featured: true,
  },
  {
    id: 4,
    name: "Miód tymiankowy z Krety",
    shortName: "Miód tymiankowy",
    category: "Miody",
    description:
      "Intensywnie aromatyczny miód z pasiek położonych wśród dzikiego tymianku. Rozlewany w małych partiach.",
    price: 39,
    unit: "400 g",
    stock: 29,
    tags: ["Kreta", "mała pasieka", "bez dodatków"],
    crop: "honey",
    featured: true,
  },
  {
    id: 5,
    name: "Oregano górskie suszone",
    shortName: "Oregano górskie",
    category: "Zioła",
    description:
      "Ręcznie zbierane i suszone w cieniu. Wyraziste, żywiczne i wyjątkowo aromatyczne.",
    price: 14.9,
    unit: "40 g",
    stock: 91,
    tags: ["ręczny zbiór", "bez dodatków", "aromatyczne"],
    crop: "oregano",
    featured: true,
  },
  {
    id: 6,
    name: "Zestaw smaków Greckiego Gaju",
    shortName: "Zestaw degustacyjny",
    category: "Oliwa",
    description:
      "Oliwa 500 ml, oliwki Kalamata i oregano górskie w pudełku prezentowym z historią naszych dostawców.",
    price: 99,
    compareAt: 108.8,
    unit: "zestaw",
    stock: 12,
    tags: ["prezent", "bestseller", "zestaw"],
    crop: "oil",
    featured: true,
  },
];

export const articles = [
  {
    id: 1,
    category: "Odżywianie",
    date: "28 lipca 2026",
    title: "Jak rozpoznać dobrą oliwę extra virgin?",
    excerpt:
      "Smak, zapach, data zbioru i sposób przechowywania mówią o oliwie więcej niż samo opakowanie.",
    crop: "oil" as const,
    time: "6 min",
  },
  {
    id: 2,
    category: "Kuchnia grecka",
    date: "16 lipca 2026",
    title: "Horiatiki: sałatka, która nie potrzebuje sałaty",
    excerpt:
      "Kilka dojrzałych składników, dobre oregano i oliwa. Cały sekret greckiego lata na jednym talerzu.",
    crop: "oregano" as const,
    time: "4 min",
  },
  {
    id: 3,
    category: "Z gaju",
    date: "2 lipca 2026",
    title: "Co dzieje się z drzewami przed zbiorem",
    excerpt:
      "Letnia obserwacja owoców, delikatne nawadnianie i przygotowanie rodzinnej ekipy do jesiennej pracy.",
    crop: "olives" as const,
    time: "5 min",
  },
];

export const groveUpdates = [
  {
    date: "Lipiec 2026",
    title: "Owoce nabierają kształtu",
    text: "Po spokojnym początku lata owoce są zdrowe i równe. Ograniczamy nawadnianie do minimum i kontrolujemy każde poletko osobno.",
  },
  {
    date: "Maj 2026",
    title: "Kwitnienie w pełni",
    text: "Ciepłe dni i chłodniejsze noce dały drzewom dobry rytm. W całym gaju unosił się delikatny zapach kwiatów oliwnych.",
  },
  {
    date: "Luty 2026",
    title: "Zimowe cięcie drzew",
    text: "Usunęliśmy stare gałęzie, aby światło dotarło do wnętrza koron. Drewno zostało wykorzystane lokalnie, nic się nie marnuje.",
  },
  {
    date: "Listopad 2025",
    title: "Pierwsze tłoczenie sezonu",
    text: "Oliwki trafiły do tłoczni kilka godzin po zbiorze. Tegoroczna oliwa jest świeża, zielona i wyraźnie pieprzna.",
  },
];

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
