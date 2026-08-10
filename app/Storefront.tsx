"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Box,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  EyeOff,
  Filter,
  Heart,
  Leaf,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Menu,
  Minus,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  articles,
  formatPrice,
  groveUpdates,
  initialProducts,
  Product,
} from "./data";
import {
  AdminArticle,
  AdminOrder,
  AdminReturn,
  ApiOrder,
  ApiUser,
  ArticlePayload,
  SiteSettings,
  storeApi,
} from "./api";

type View =
  | "home"
  | "shop"
  | "journal"
  | "grove"
  | "contact"
  | "account"
  | "admin";

type CartLine = { productId: number; quantity: number };
type LegalPage = "privacy" | "terms" | "returns" | null;
type ArticleContent = {
  id: number;
  category: string;
  date: string;
  title: string;
  excerpt: string;
  body?: string;
  imageUrl?: string | null;
  crop: Product["crop"];
  time: string;
};
type GroveContent = {
  id?: number;
  date: string;
  title: string;
  text: string;
  crop?: Product["crop"];
};

const navItems: { id: View; label: string }[] = [
  { id: "shop", label: "Sklep" },
  { id: "grove", label: "Nasz gaj" },
  { id: "journal", label: "Dziennik" },
  { id: "contact", label: "Kontakt" },
];

const parcelLockers = [
  {
    code: "WAW01M",
    address: "ul. Świętokrzyska 14, Warszawa",
    hours: "24/7",
  },
  {
    code: "WAW33N",
    address: "ul. Marszałkowska 87, Warszawa",
    hours: "24/7",
  },
  {
    code: "WAW95A",
    address: "ul. Grzybowska 43, Warszawa",
    hours: "24/7",
  },
];

function ProductVisual({
  crop,
  className = "",
  imageUrl,
  alt = "",
}: {
  crop: Product["crop"];
  className?: string;
  imageUrl?: string | null;
  alt?: string;
}) {
  return (
    <div className={"product-visual crop-" + crop + " " + className}>
      {imageUrl ? (
        // Dynamic administrator-provided media cannot use a fixed Next image loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} />
      ) : (
        <div className="product-photo" />
      )}
    </div>
  );
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Grecki Gaj, strona główna">
      <span className="brand-mark">
        <Leaf size={20} strokeWidth={1.8} />
      </span>
      <span>
        <strong>GRECKI GAJ</strong>
        <small>prosto z Peloponezu</small>
      </span>
    </button>
  );
}

function QuantityControl({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={"quantity-control" + (compact ? " compact" : "")}>
      <button
        aria-label="Zmniejsz liczbę"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={15} />
      </button>
      <span>{value}</span>
      <button aria-label="Zwiększ liczbę" onClick={() => onChange(value + 1)}>
        <Plus size={15} />
      </button>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  onOpen,
}: {
  product: Product;
  onAdd: (product: Product) => void;
  onOpen: (product: Product) => void;
}) {
  return (
    <article className="product-card">
      <button className="product-image-button" onClick={() => onOpen(product)}>
        <ProductVisual
          crop={product.crop}
          imageUrl={product.images?.[0]?.url}
          alt={product.images?.[0]?.alt || product.name}
        />
        {product.tags.includes("bestseller") && (
          <span className="product-badge">Bestseller</span>
        )}
        <span className="heart-button" aria-hidden="true">
          <Heart size={18} />
        </span>
      </button>
      <div className="product-info">
        <div className="product-meta">
          <span>{product.category}</span>
          <span>{product.unit}</span>
        </div>
        <button className="product-title" onClick={() => onOpen(product)}>
          {product.name}
        </button>
        <p>{product.description}</p>
        <div className="product-bottom">
          <div className="price-line">
            <strong>{formatPrice(product.price)}</strong>
            {product.compareAt && <del>{formatPrice(product.compareAt)}</del>}
          </div>
          <button
            className="icon-action dark"
            onClick={() => onAdd(product)}
            aria-label={"Dodaj " + product.name + " do koszyka"}
            title="Dodaj do koszyka"
          >
            <Plus size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function Storefront() {
  const [view, setView] = useState<View>("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [journalArticles, setJournalArticles] = useState<ArticleContent[]>(articles);
  const [groveNews, setGroveNews] = useState<GroveContent[]>(groveUpdates);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    groveTitle: "Historia zapisana w słojach",
    groveDescription:
      "Pierwsze drzewa posadził nasz dziadek Nikos. Nie marzył wtedy o sklepie internetowym. Chciał po prostu robić uczciwą oliwę dla rodziny i sąsiadów.",
    groveSecondaryDescription:
      "Dziś łączymy tę samą pracę z kontrolą każdej partii, transportem w stabilnej temperaturze i magazynem w Polsce.",
    contactPhone: "+48 500 100 200",
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleContent | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [category, setCategory] = useState("Wszystkie");
  const [sort, setSort] = useState("Polecane");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [delivery, setDelivery] = useState<"locker" | "courier">("locker");
  const [locker, setLocker] = useState(parcelLockers[0]);
  const [lockerOpen, setLockerOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
  });
  const [accountTab, setAccountTab] = useState<
    "login" | "register" | "profile" | "orders" | "returns"
  >("login");
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [authError, setAuthError] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminModal, setAdminModal] = useState<Product | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [returnSent, setReturnSent] = useState(false);
  const cartToken = useRef("");
  const cartHydrated = useRef(false);

  async function refreshPublicContent() {
    const content = await storeApi.content();
    setJournalArticles(content.articles.map((article) => ({
      ...article,
      date: new Date(article.date).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    })));
    setGroveNews(content.groveUpdates.map((update) => ({
      ...update,
      date: new Date(update.date).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    })));
    setSiteSettings(content.settings);
  }

  useEffect(() => {
    const cookieChoice = window.localStorage.getItem("grecki-gaj-cookies");
    const hash = window.location.hash.replace("#", "") as View;
    const frame = window.requestAnimationFrame(() => {
      if (!cookieChoice) setCookieVisible(true);
      if (
        ["shop", "journal", "grove", "contact", "account", "admin"].includes(
          hash,
        )
      ) {
        setView(hash);
      }
    });

    async function loadStore() {
      try {
        const { products: storedProducts } = await storeApi.products();
        setProducts(storedProducts);
        await refreshPublicContent();

        let token = window.localStorage.getItem("grecki-gaj-cart-token") || "";
        if (!token) {
          token = (await storeApi.createCart()).token;
          window.localStorage.setItem("grecki-gaj-cart-token", token);
        }
        cartToken.current = token;
        const storedCart = await storeApi.cart(token);
        setCart(storedCart.items);
        cartHydrated.current = true;
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Nie udało się wczytać sklepu");
      }

      try {
        const { user } = await storeApi.me();
        setCurrentUser(user);
        setCustomer((value) => ({
          ...value,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }));
        const result = await storeApi.orders();
        setOrders(result.orders);
      } catch {
        setCurrentUser(null);
      }
    }

    void loadStore();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!cartHydrated.current || !cartToken.current) return;
    const timeout = window.setTimeout(() => {
      void storeApi.syncCart(cartToken.current, cart).catch((error) => {
        setToast(error instanceof Error ? error.message : "Nie udało się zapisać koszyka");
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [cart]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeProducts = products.filter((product) => !product.softDeleted);

  const filteredProducts = useMemo(() => {
    let result = activeProducts.filter((product) => {
      const categoryMatch =
        category === "Wszystkie" || product.category === category;
      const query = search.trim().toLowerCase();
      const searchMatch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.tags.join(" ").toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
    if (sort === "Cena rosnąco") {
      result = [...result].sort((a, b) => a.price - b.price);
    }
    if (sort === "Cena malejąco") {
      result = [...result].sort((a, b) => b.price - a.price);
    }
    return result;
  }, [activeProducts, category, search, sort]);

  const cartDetails = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId);
          return product ? { ...line, product } : null;
        })
        .filter(Boolean) as (CartLine & { product: Product })[],
    [cart, products],
  );

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartDetails.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const deliveryCost = subtotal >= 199 ? 0 : delivery === "locker" ? 12.99 : 16.99;
  const total = subtotal + deliveryCost;

  function navigate(nextView: View) {
    setView(nextView);
    setMobileMenu(false);
    window.location.hash = nextView === "home" ? "start" : nextView;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addToCart(product: Product, quantity = 1) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        );
      }
      return [...current, { productId: product.id, quantity }];
    });
    setToast(product.shortName + " dodano do koszyka");
  }

  function updateCart(productId: number, quantity: number) {
    if (quantity <= 0) {
      setCart((current) =>
        current.filter((line) => line.productId !== productId),
      );
      return;
    }
    setCart((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    );
  }

  function openCheckout() {
    setCartOpen(false);
    setCheckoutOpen(true);
    setCheckoutStep(0);
    setOrderPlaced(false);
    setCheckoutError("");
  }

  function nextCheckoutStep() {
    if (
      checkoutStep === 0 &&
      (!customer.firstName ||
        !customer.lastName ||
        !customer.email ||
        !customer.street ||
        !customer.zip ||
        !customer.city)
    ) {
      setCheckoutError("Uzupełnij wymagane dane, aby przejść dalej.");
      return;
    }
    setCheckoutError("");
    setCheckoutStep((step) => Math.min(step + 1, 3));
  }

  async function placeOrder() {
    try {
      setCheckoutError("");
      const result = await storeApi.createOrder({
        cartToken: cartToken.current,
        customer,
        delivery,
        lockerCode: delivery === "locker" ? locker.code : undefined,
        lockerAddress: delivery === "locker" ? locker.address : undefined,
      });
      setOrderNumber(result.order.number);
      setOrderPlaced(true);
      cartHydrated.current = false;
      setCart([]);
      const nextCart = await storeApi.createCart();
      cartToken.current = nextCart.token;
      window.localStorage.setItem("grecki-gaj-cart-token", nextCart.token);
      cartHydrated.current = true;
      try {
        const updatedCatalog = await storeApi.products();
        setProducts(updatedCatalog.products);
      } catch {
        // The order is already saved; a catalog refresh can retry on the next load.
      }
      if (currentUser) {
        const accountOrders = await storeApi.orders();
        setOrders(accountOrders.orders);
      }
      setToast("Zamówienie zostało zapisane w bazie");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Nie udało się złożyć zamówienia");
    }
  }

  function acceptCookies(mode: "all" | "essential") {
    window.localStorage.setItem("grecki-gaj-cookies", mode);
    setCookieVisible(false);
  }

  async function saveAdminProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      shortName: String(form.get("shortName")),
      category: String(form.get("category")) as Product["category"],
      description: String(form.get("description")),
      ingredients: String(form.get("ingredients") || ""),
      allergens: String(form.get("allergens") || ""),
      origin: String(form.get("origin") || "Grecja"),
      price: Number(form.get("price")),
      compareAt: form.get("compareAt") ? Number(form.get("compareAt")) : undefined,
      unit: String(form.get("unit")),
      stock: Number(form.get("stock")),
      tags: String(form.get("tags"))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      crop: String(form.get("crop")) as Product["crop"],
      featured: Boolean(form.get("featured")),
      imageUrl: String(form.get("imageUrl") || ""),
    };
    try {
      const result = adminModal === "new"
        ? await storeApi.createProduct(payload)
        : await storeApi.updateProduct((adminModal as Product).id, payload);
      setProducts((current) =>
        adminModal === "new"
          ? [result.product, ...current]
          : current.map((item) => item.id === result.product.id ? result.product : item),
      );
      setAdminModal(null);
      setToast(adminModal === "new" ? "Produkt zapisany w bazie" : "Zmiany zapisane w bazie");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się zapisać produktu");
    }
  }

  async function softDeleteProduct(product: Product) {
    try {
      await storeApi.archiveProduct(product.id, !product.softDeleted);
      setProducts((current) => current.map((item) =>
        item.id === product.id ? { ...item, softDeleted: !item.softDeleted } : item,
      ));
      setToast(product.softDeleted ? "Produkt przywrócony" : "Produkt ukryty");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się zmienić produktu");
    }
  }

  async function hardDeleteProduct(product: Product) {
    if (!window.confirm("Trwale usunąć produkt „" + product.name + "”?")) return;
    try {
      await storeApi.deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setCart((current) => current.filter((item) => item.productId !== product.id));
      setToast("Produkt został trwale usunięty z bazy");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się usunąć produktu");
    }
  }

  async function login(email: string, password: string) {
    try {
      setAuthError("");
      const { user } = await storeApi.login(email, password);
      setCurrentUser(user);
      setCustomer((value) => ({
        ...value,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }));
      if (user.role === "admin") {
        navigate("admin");
      } else {
        const result = await storeApi.orders();
        setOrders(result.orders);
        setAccountTab("orders");
      }
      setToast("Zalogowano");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nie udało się zalogować");
    }
  }

  async function register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    try {
      setAuthError("");
      const result = await storeApi.register(data);
      setVerificationUrl(result.localVerificationUrl);
      setToast("Konto utworzone. Potwierdź adres e-mail.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nie udało się utworzyć konta");
    }
  }

  async function logout() {
    await storeApi.logout().catch(() => undefined);
    setCurrentUser(null);
    setOrders([]);
    setAccountTab("login");
  }

  async function createReturn(data: {
    orderNumber: string;
    kind: string;
    description: string;
  }) {
    try {
      await storeApi.createReturn(data);
      setReturnSent(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się wysłać zgłoszenia");
    }
  }

  return (
    <div className="app-shell">
      <div className="announcement">
        <span>Darmowa dostawa od 199 zł</span>
        <span className="announcement-detail">
          Wysyłka z Polski w 1–2 dni robocze
        </span>
      </div>

      <header className="site-header">
        <div className="header-inner">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Otwórz menu"
          >
            <Menu size={22} />
          </button>
          <Logo onClick={() => navigate("home")} />
          <nav className="desktop-nav" aria-label="Główna nawigacja">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Szukaj"
              title="Szukaj"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => navigate("account")}
              aria-label="Moje konto"
              title="Moje konto"
            >
              <UserRound size={20} />
            </button>
            <button
              className="cart-button"
              onClick={() => setCartOpen(true)}
              aria-label={"Koszyk, produktów: " + itemCount}
              title="Koszyk"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && <span>{itemCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {mobileMenu && (
        <div className="mobile-menu-panel">
          <div className="mobile-menu-top">
            <Logo onClick={() => navigate("home")} />
            <button
              className="icon-action"
              onClick={() => setMobileMenu(false)}
              aria-label="Zamknij menu"
            >
              <X size={21} />
            </button>
          </div>
          <nav>
            {navItems.map((item) => (
              <button key={item.id} onClick={() => navigate(item.id)}>
                {item.label}
                <ArrowRight size={20} />
              </button>
            ))}
            <button onClick={() => navigate("account")}>
              Moje konto
              <ArrowRight size={20} />
            </button>
          </nav>
        </div>
      )}

      <main>
        {view === "home" && (
          <HomeView
            products={activeProducts.filter((product) => product.featured)}
            articles={journalArticles}
            onAdd={addToCart}
            onOpen={setSelectedProduct}
            onOpenArticle={setSelectedArticle}
            onNavigate={navigate}
          />
        )}
        {view === "shop" && (
          <ShopView
            products={filteredProducts}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            onAdd={addToCart}
            onOpen={setSelectedProduct}
            query={search}
          />
        )}
        {view === "journal" && (
          <JournalView articles={journalArticles} onOpenArticle={setSelectedArticle} />
        )}
        {view === "grove" && (
          <GroveView settings={siteSettings} updates={groveNews} onNavigate={navigate} />
        )}
        {view === "contact" && <ContactView settings={siteSettings} />}
        {view === "account" && (
          <AccountView
            tab={accountTab}
            setTab={setAccountTab}
            user={currentUser}
            orders={orders}
            authError={authError}
            verificationUrl={verificationUrl}
            onLogin={login}
            onRegister={register}
            onLogout={logout}
            onReturn={createReturn}
            onOpenAdmin={() => navigate("admin")}
            returnSent={returnSent}
            setReturnSent={setReturnSent}
          />
        )}
        {view === "admin" && (
          <AdminView
            products={products}
            query={adminSearch}
            setQuery={setAdminSearch}
            onEdit={setAdminModal}
            onSoftDelete={softDeleteProduct}
            onHardDelete={hardDeleteProduct}
            isAdmin={currentUser?.role === "admin"}
            onOpenAccount={() => navigate("account")}
            onContentChanged={refreshPublicContent}
          />
        )}
      </main>

      <Footer onNavigate={navigate} onLegal={setLegalPage} />

      {cartOpen && (
        <CartDrawer
          lines={cartDetails}
          subtotal={subtotal}
          onClose={() => setCartOpen(false)}
          onUpdate={updateCart}
          onCheckout={openCheckout}
          onShop={() => {
            setCartOpen(false);
            navigate("shop");
          }}
        />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          quantity={productQuantity}
          setQuantity={setProductQuantity}
          onClose={() => {
            setSelectedProduct(null);
            setProductQuantity(1);
          }}
          onAdd={() => {
            addToCart(selectedProduct, productQuantity);
            setSelectedProduct(null);
            setProductQuantity(1);
          }}
        />
      )}

      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      {checkoutOpen && (
        <Checkout
          step={checkoutStep}
          setStep={setCheckoutStep}
          lines={cartDetails}
          subtotal={subtotal}
          deliveryCost={deliveryCost}
          total={total}
          delivery={delivery}
          setDelivery={setDelivery}
          locker={locker}
          customer={customer}
          setCustomer={setCustomer}
          error={checkoutError}
          orderPlaced={orderPlaced}
          orderNumber={orderNumber}
          onNext={nextCheckoutStep}
          onPlaceOrder={placeOrder}
          onClose={() => setCheckoutOpen(false)}
          onOpenLocker={() => setLockerOpen(true)}
          onNavigateAccount={() => {
            setCheckoutOpen(false);
            setAccountTab("orders");
            navigate("account");
          }}
        />
      )}

      {lockerOpen && (
        <LockerPicker
          selected={locker.code}
          onSelect={(nextLocker) => {
            setLocker(nextLocker);
            setLockerOpen(false);
          }}
          onClose={() => setLockerOpen(false)}
        />
      )}

      {searchOpen && (
        <SearchOverlay
          value={search}
          setValue={setSearch}
          products={activeProducts}
          onClose={() => setSearchOpen(false)}
          onShowResults={() => {
            setSearchOpen(false);
            navigate("shop");
          }}
          onOpenProduct={(product) => {
            setSearchOpen(false);
            setSelectedProduct(product);
          }}
        />
      )}

      {adminModal && (
        <AdminProductModal
          product={adminModal}
          onClose={() => setAdminModal(null)}
          onSave={saveAdminProduct}
        />
      )}

      {legalPage && (
        <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
      )}

      {cookieVisible && (
        <CookieBanner
          onAccept={() => acceptCookies("all")}
          onEssential={() => acceptCookies("essential")}
          onPrivacy={() => setLegalPage("privacy")}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function HomeView({
  products,
  articles,
  onAdd,
  onOpen,
  onOpenArticle,
  onNavigate,
}: {
  products: Product[];
  articles: ArticleContent[];
  onAdd: (product: Product) => void;
  onOpen: (product: Product) => void;
  onOpenArticle: (article: ArticleContent) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <>
      <section className="hero" id="start">
        <div className="hero-content">
          <span className="eyebrow light">Rodzinne zbiory · Peloponez</span>
          <h1>Oliwa z rodzinnego gaju</h1>
          <p>
            Tłoczona w Grecji, przechowywana i wysyłana z Polski. Znamy każde
            drzewo, każdą partię i drogę, którą oliwa trafia na Twój stół.
          </p>
          <div className="hero-actions">
            <button className="button primary light" onClick={() => onNavigate("shop")}>
              Zobacz produkty
              <ArrowRight size={18} />
            </button>
            <button className="text-link light" onClick={() => onNavigate("grove")}>
              Poznaj nasz gaj
            </button>
          </div>
        </div>
        <div className="harvest-note">
          <span>Zbiór</span>
          <strong>2025</strong>
          <small>Tłoczenie w dniu zbioru</small>
        </div>
      </section>

      <section className="trust-strip" aria-label="Najważniejsze informacje">
        <div>
          <Leaf size={22} />
          <span>
            <strong>Z jednego gaju</strong>
            Pełna identyfikowalność
          </span>
        </div>
        <div>
          <PackageCheck size={22} />
          <span>
            <strong>Magazyn w Polsce</strong>
            Szybka, bezpieczna wysyłka
          </span>
        </div>
        <div>
          <ShieldCheck size={22} />
          <span>
            <strong>Sprawdzony skład</strong>
            Bez zbędnych dodatków
          </span>
        </div>
        <div>
          <Truck size={22} />
          <span>
            <strong>InPost</strong>
            Paczkomat lub kurier
          </span>
        </div>
      </section>

      <section className="section products-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Spiżarnia Greckiego Gaju</span>
            <h2>Smaki, które znamy u źródła</h2>
          </div>
          <button className="text-link" onClick={() => onNavigate("shop")}>
            Wszystkie produkty
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="product-grid">
          {products.slice(0, 4).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={onAdd}
              onOpen={onOpen}
            />
          ))}
        </div>
      </section>

      <section className="story-band">
        <div className="story-photo" />
        <div className="story-copy">
          <span className="eyebrow">Messenia, Grecja</span>
          <h2>Od trzech pokoleń pracujemy w rytmie drzew</h2>
          <p>
            Nasz gaj leży między wzgórzami a Morzem Jońskim. Zbiory zaczynamy
            wcześnie, kiedy oliwki są jeszcze zielone. Dają mniej oliwy, ale
            więcej aromatu i charakterystyczną, pieprzną końcówkę.
          </p>
          <div className="story-facts">
            <span>
              <strong>320</strong>
              drzew
            </span>
            <span>
              <strong>6 h</strong>
              od zbioru do tłoczni
            </span>
            <span>
              <strong>1</strong>
              rodzinna partia
            </span>
          </div>
          <button className="button secondary" onClick={() => onNavigate("grove")}>
            Historia naszego gaju
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="section journal-preview">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dziennik</span>
            <h2>Zdrowie, kuchnia i wieści z Grecji</h2>
          </div>
          <button className="text-link" onClick={() => onNavigate("journal")}>
            Czytaj wszystkie
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="article-grid">
          {articles.map((article) => (
            <article className="article-card" key={article.id}>
              <ProductVisual
                crop={article.crop}
                className="article-image"
                imageUrl={article.imageUrl}
                alt={article.title}
              />
              <div>
                <span className="article-meta">
                  {article.category} · {article.time}
                </span>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <button className="read-link" onClick={() => onOpenArticle(article)}>
                  Czytaj
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="newsletter-band">
        <div>
          <span className="eyebrow light">Listy z gaju</span>
          <h2>Raz w miesiącu, bez pośpiechu</h2>
          <p>
            Sezonowe przepisy, wiadomości z Grecji i pierwszeństwo do nowych
            partii.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Adres e-mail
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Twój adres e-mail"
            required
          />
          <button className="button primary light" type="submit">
            Zapisuję się
          </button>
        </form>
      </section>
    </>
  );
}

function ShopView({
  products,
  category,
  setCategory,
  sort,
  setSort,
  onAdd,
  onOpen,
  query,
}: {
  products: Product[];
  category: string;
  setCategory: (category: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  onAdd: (product: Product) => void;
  onOpen: (product: Product) => void;
  query: string;
}) {
  const categories = ["Wszystkie", "Oliwa", "Oliwki", "Miody", "Zioła"];
  return (
    <div className="page shop-page">
      <section className="page-heading shop-heading">
        <div>
          <span className="eyebrow">Grecka spiżarnia</span>
          <h1>{query ? "Wyniki wyszukiwania" : "Produkty"}</h1>
          <p>
            Krótki skład, znane pochodzenie i smak, do którego chce się wracać.
          </p>
        </div>
        <div className="shop-heading-art">
          <Leaf size={44} strokeWidth={1.2} />
        </div>
      </section>
      <section className="section shop-content">
        <div className="filter-row">
          <div className="category-tabs">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="select-control">
            <Filter size={16} />
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option>Polecane</option>
              <option>Cena rosnąco</option>
              <option>Cena malejąco</option>
            </select>
          </label>
        </div>
        {query && (
          <p className="result-note">
            Dla hasła „{query}” znaleziono: <strong>{products.length}</strong>
          </p>
        )}
        {products.length ? (
          <div className="product-grid shop-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={onAdd}
                onOpen={onOpen}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search size={28} />}
            title="Nie znaleźliśmy takich produktów"
            text="Zmień kategorię lub wpisz inną nazwę."
          />
        )}
      </section>
    </div>
  );
}

function JournalView({
  articles,
  onOpenArticle,
}: {
  articles: ArticleContent[];
  onOpenArticle: (article: ArticleContent) => void;
}) {
  return (
    <div className="page journal-page">
      <section className="page-heading editorial-heading">
        <span className="eyebrow">Dziennik Greckiego Gaju</span>
        <h1>Dobrze wiedzieć, co trafia na stół</h1>
        <p>
          Rzetelnie o oliwie, prostym jedzeniu i codzienności w greckim gaju.
        </p>
      </section>
      <section className="section featured-article">
        <div className="featured-article-photo" />
        <div>
          <span className="article-meta">Odżywianie · 6 min</span>
          <h2>Jak rozpoznać dobrą oliwę extra virgin?</h2>
          <p>
            Dobra oliwa pachnie świeżo skoszoną trawą, liśćmi pomidora albo
            zielonym migdałem. Jej lekka gorycz i pieprzność to znak obecności
            naturalnych polifenoli, a nie wada produktu.
          </p>
          <button className="button secondary" onClick={() => articles[0] && onOpenArticle(articles[0])}>
            Czytaj artykuł
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section className="section">
        <div className="journal-toolbar">
          <h2>Najnowsze artykuły</h2>
          <div className="category-tabs">
            <button className="active">Wszystkie</button>
            <button>Zdrowie</button>
            <button>Kuchnia</button>
            <button>Z gaju</button>
          </div>
        </div>
        <div className="article-grid wide">
          {[...articles, ...articles].map((article, index) => (
            <article className="article-card" key={article.id + "-" + index}>
              <ProductVisual
                crop={article.crop}
                className="article-image"
                imageUrl={article.imageUrl}
                alt={article.title}
              />
              <div>
                <span className="article-meta">
                  {article.category} · {article.date}
                </span>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <button className="read-link" onClick={() => onOpenArticle(article)}>
                  Czytaj
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GroveView({
  settings,
  updates,
  onNavigate,
}: {
  settings: SiteSettings;
  updates: GroveContent[];
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="page grove-page">
      <section className="grove-hero">
        <div>
          <span className="eyebrow light">Messenia · 37°02′N 22°00′E</span>
          <h1>Nasz kawałek Grecji</h1>
          <p>
            320 drzew Koroneiki, rodzinne ręce i cierpliwość, której nie da się
            przyspieszyć.
          </p>
        </div>
      </section>
      <section className="grove-intro">
        <div>
          <span className="eyebrow">Od 1968 roku</span>
          <h2>{settings.groveTitle}</h2>
        </div>
        <div>
          <p>{settings.groveDescription}</p>
          <p>{settings.groveSecondaryDescription}</p>
        </div>
      </section>
      <section className="section grove-updates">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Prosto z Grecji</span>
            <h2>Co słychać w gaju</h2>
          </div>
          <span className="live-mark">
            <span />
            Ostatnia aktualizacja: 28 lipca
          </span>
        </div>
        <div className="timeline">
          {updates.map((update, index) => (
            <article key={update.date}>
              <div className="timeline-marker">
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <time>{update.date}</time>
                <h3>{update.title}</h3>
                <p>{update.text}</p>
              </div>
              <ProductVisual
                crop={index % 2 ? "oregano" : "olives"}
                className="timeline-image"
              />
            </article>
          ))}
        </div>
      </section>
      <section className="grove-cta">
        <div>
          <span className="eyebrow light">Obecna partia</span>
          <h2>Spróbuj oliwy z ostatniego zbioru</h2>
        </div>
        <button className="button primary light" onClick={() => onNavigate("shop")}>
          Przejdź do sklepu
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

function ContactView({ settings }: { settings: SiteSettings }) {
  return (
    <div className="page contact-page">
      <section className="page-heading">
        <span className="eyebrow">Kontakt</span>
        <h1>Porozmawiajmy</h1>
        <p>
          O produktach, dostawie albo współpracy. Odpowiadamy w dni robocze
          zwykle w ciągu 24 godzin.
        </p>
      </section>
      <section className="contact-layout">
        <div className="contact-details">
          <div>
            <Mail size={21} />
            <span>
              <small>E-mail</small>
              <a href="mailto:hello@greckigaj.pl">hello@greckigaj.pl</a>
            </span>
          </div>
          <div>
            <Phone size={21} />
            <span>
              <small>Telefon</small>
              <a href={"tel:" + settings.contactPhone.replace(/\s/g, "")}>
                {settings.contactPhone}
              </a>
            </span>
          </div>
          <div>
            <MapPin size={21} />
            <span>
              <small>Magazyn i biuro</small>
              ul. Oliwna 12, 05-090 Sękocin
            </span>
          </div>
          <div className="company-data">
            <small>Dane sprzedawcy</small>
            <strong>Grecki Gaj sp. z o.o.</strong>
            <span>NIP: 000 000 00 00 · KRS: 0000000000</span>
            <em>Dane przykładowe do uzupełnienia przed uruchomieniem.</em>
          </div>
          <div className="social-row">
            <button aria-label="Instagram" title="Instagram">
              <AtSign size={19} />
            </button>
            <button aria-label="Facebook" title="Facebook">
              <MessageCircle size={19} />
            </button>
          </div>
        </div>
        <form
          className="contact-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="form-row">
            <label>
              Imię
              <input placeholder="Jan" required />
            </label>
            <label>
              E-mail
              <input type="email" placeholder="jan@example.pl" required />
            </label>
          </div>
          <label>
            Temat
            <select>
              <option>Pytanie o produkt</option>
              <option>Dostawa i zamówienie</option>
              <option>Współpraca</option>
              <option>Inna sprawa</option>
            </select>
          </label>
          <label>
            Wiadomość
            <textarea rows={6} placeholder="W czym możemy pomóc?" required />
          </label>
          <label className="check-field">
            <input type="checkbox" required />
            <span>
              Zgadzam się na przetwarzanie danych w celu obsługi zapytania.
            </span>
          </label>
          <button className="button primary" type="submit">
            Wyślij wiadomość
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

function AccountView({
  tab,
  setTab,
  user,
  orders,
  authError,
  verificationUrl,
  onLogin,
  onRegister,
  onLogout,
  onReturn,
  onOpenAdmin,
  returnSent,
  setReturnSent,
}: {
  tab: "login" | "register" | "profile" | "orders" | "returns";
  setTab: (
    tab: "login" | "register" | "profile" | "orders" | "returns",
  ) => void;
  user: ApiUser | null;
  orders: ApiOrder[];
  authError: string;
  verificationUrl: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onReturn: (data: {
    orderNumber: string;
    kind: string;
    description: string;
  }) => Promise<void>;
  onOpenAdmin: () => void;
  returnSent: boolean;
  setReturnSent: (sent: boolean) => void;
}) {
  if (!user) {
    return (
      <div className="page account-auth-page">
        <section className="auth-panel">
          <div className="auth-art">
            <span className="eyebrow light">Twoje miejsce</span>
            <h1>Smaki, zamówienia i adresy w jednym miejscu</h1>
            <ul>
              <li>
                <Check size={17} /> Historia i status zamówień
              </li>
              <li>
                <Check size={17} /> Zapisane dane dostawy
              </li>
              <li>
                <Check size={17} /> Prostsze zwroty i reklamacje
              </li>
            </ul>
          </div>
          <div className="auth-form-wrap">
            <div className="auth-tabs">
              <button
                className={tab === "login" ? "active" : ""}
                onClick={() => setTab("login")}
              >
                Logowanie
              </button>
              <button
                className={tab === "register" ? "active" : ""}
                onClick={() => setTab("register")}
              >
                Nowe konto
              </button>
            </div>
            {tab === "login" ? (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onLogin(String(form.get("email")), String(form.get("password")));
                }}
              >
                <h2>Witaj ponownie</h2>
                <p>Zaloguj się, aby zobaczyć swoje zamówienia.</p>
                <label>
                  E-mail
                  <input name="email" type="email" defaultValue="anna@greckigaj.local" required />
                </label>
                <label>
                  Hasło
                  <input name="password" type="password" defaultValue="Klient123!" required />
                </label>
                <button className="forgot-link" type="button">
                  Nie pamiętam hasła
                </button>
                <button className="button primary full" type="submit">
                  Zaloguj się
                </button>
                {authError && <small className="demo-hint">{authError}</small>}
                <small className="demo-hint">Konto lokalne: anna@greckigaj.local / Klient123!</small>
              </form>
            ) : (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onRegister({
                    firstName: String(form.get("firstName")),
                    lastName: String(form.get("lastName")),
                    email: String(form.get("email")),
                    password: String(form.get("password")),
                  });
                }}
              >
                <h2>Utwórz konto</h2>
                <p>Po rejestracji wyślemy link potwierdzający adres e-mail.</p>
                <div className="form-row">
                  <label>
                    Imię
                    <input name="firstName" placeholder="Anna" required />
                  </label>
                  <label>
                    Nazwisko
                    <input name="lastName" placeholder="Nowak" required />
                  </label>
                </div>
                <label>
                  E-mail
                  <input name="email" type="email" placeholder="anna@example.pl" required />
                </label>
                <label>
                  Hasło
                  <input name="password" type="password" minLength={8} placeholder="Min. 8 znaków" required />
                </label>
                <label className="check-field">
                  <input type="checkbox" required />
                  <span>Akceptuję regulamin i politykę prywatności.</span>
                </label>
                <button className="button primary full" type="submit">
                  Utwórz konto
                </button>
                {authError && <small className="demo-hint">{authError}</small>}
                {verificationUrl && (
                  <a className="text-link" href={verificationUrl}>
                    Potwierdź e-mail w środowisku lokalnym
                  </a>
                )}
              </form>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page account-page">
      <aside className="account-sidebar">
        <div className="account-person">
          <span>{user.firstName[0]}{user.lastName[0]}</span>
          <div>
            <strong>{user.firstName} {user.lastName}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <nav>
          <button
            className={tab === "orders" ? "active" : ""}
            onClick={() => setTab("orders")}
          >
            <ShoppingBag size={18} />
            Zamówienia
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            <CircleUserRound size={18} />
            Profil i adresy
          </button>
          <button
            className={tab === "returns" ? "active" : ""}
            onClick={() => setTab("returns")}
          >
            <RotateCcw size={18} />
            Zwroty i reklamacje
          </button>
          {user.role === "admin" && (
            <button onClick={onOpenAdmin}>
              <ShieldCheck size={18} />
              Panel administracyjny
            </button>
          )}
          <button
            onClick={() => {
              void onLogout();
            }}
          >
            <LogOut size={18} />
            Wyloguj się
          </button>
        </nav>
      </aside>
      <section className="account-content">
        {tab === "orders" && (
          <>
            <div className="content-heading">
              <div>
                <span className="eyebrow">Moje konto</span>
                <h1>Zamówienia</h1>
              </div>
            </div>
            {orders.length === 0 && (
              <EmptyState
                icon={<ShoppingBag size={30} />}
                title="Brak zamówień"
                text="Pierwsze zamówienie pojawi się tutaj od razu po jego złożeniu."
              />
            )}
            {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-card-head">
                  <div>
                    <span>Zamówienie {order.number}</span>
                    <small>
                      {new Date(order.createdAt).toLocaleDateString("pl-PL")} · {order.items.length} produktów
                    </small>
                  </div>
                  <span className="status delivered">{order.status}</span>
                </div>
                <div className="order-products">
                  {order.items.slice(0, 3).map((item) => (
                    <ProductVisual crop="oil" key={item.id} />
                  ))}
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                <div className="order-actions">
                  <button className="text-link" onClick={() => setTab("returns")}>
                    Zgłoś problem
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        {tab === "profile" && (
          <>
            <div className="content-heading">
              <div>
                <span className="eyebrow">Moje konto</span>
                <h1>Profil i adresy</h1>
              </div>
              <span className="status default">Dane z PostgreSQL</span>
            </div>
            <div className="profile-section">
              <h2>Dane podstawowe</h2>
              <div className="form-grid">
                <label>
                  Imię
                  <input value={user.firstName} readOnly />
                </label>
                <label>
                  Nazwisko
                  <input value={user.lastName} readOnly />
                </label>
                <label>
                  E-mail
                  <input value={user.email} readOnly />
                </label>
                <label>
                  Telefon
                  <input value={user.addresses?.[0]?.phone || ""} readOnly />
                </label>
              </div>
            </div>
            <div className="profile-section">
              <div className="profile-section-head">
                <h2>Zapisane adresy</h2>
                <span>{user.addresses?.length || 0} zapisanych</span>
              </div>
              {user.addresses?.map((address) => (
                <div className="address-card" key={address.id}>
                  {address.isDefault && <span className="status default">Domyślny</span>}
                  <strong>{address.label}</strong>
                  <p>
                    {address.firstName} {address.lastName}
                    <br />
                    {address.street}
                    <br />
                    {address.postalCode} {address.city}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "returns" && (
          <>
            <div className="content-heading">
              <div>
                <span className="eyebrow">Pomoc po zakupie</span>
                <h1>Zwroty i reklamacje</h1>
              </div>
            </div>
            {returnSent ? (
              <EmptyState
                icon={<Check size={30} />}
                title="Zgłoszenie zostało przyjęte"
                text="Potwierdzenie i dalsze instrukcje wysłaliśmy na Twój adres e-mail."
                action={
                  <button
                    className="button secondary"
                    onClick={() => setReturnSent(false)}
                  >
                    Nowe zgłoszenie
                  </button>
                }
              />
            ) : (
              <form
                className="return-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onReturn({
                    orderNumber: String(form.get("orderNumber")),
                    kind: String(form.get("kind")),
                    description: String(form.get("description")),
                  });
                }}
              >
                <div className="info-banner">
                  <RotateCcw size={20} />
                  <p>
                    Na odstąpienie od umowy zawartej online masz 14 dni od
                    otrzymania produktu. Reklamację możesz złożyć niezależnie od
                    prawa zwrotu.
                  </p>
                </div>
                <label>
                  Zamówienie
                  <select name="orderNumber" required>
                    {orders.map((order) => (
                      <option value={order.number} key={order.id}>
                        {order.number} · {new Date(order.createdAt).toLocaleDateString("pl-PL")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rodzaj zgłoszenia
                  <select name="kind" required>
                    <option>Odstąpienie od umowy</option>
                    <option>Reklamacja produktu</option>
                    <option>Uszkodzona przesyłka</option>
                    <option>Brak produktu w paczce</option>
                  </select>
                </label>
                <label>
                  Opis
                  <textarea
                    name="description"
                    rows={5}
                    placeholder="Opisz krótko, czego dotyczy zgłoszenie"
                    required
                  />
                </label>
                <label>
                  Zdjęcia
                  <input type="file" accept="image/*" multiple />
                </label>
                <button className="button primary" type="submit">
                  Wyślij zgłoszenie
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function AdminView({
  products,
  query,
  setQuery,
  onEdit,
  onSoftDelete,
  onHardDelete,
  isAdmin,
  onOpenAccount,
  onContentChanged,
}: {
  products: Product[];
  query: string;
  setQuery: (query: string) => void;
  onEdit: (product: Product | "new") => void;
  onSoftDelete: (product: Product) => Promise<void>;
  onHardDelete: (product: Product) => Promise<void>;
  isAdmin: boolean;
  onOpenAccount: () => void;
  onContentChanged: () => Promise<void>;
}) {
  const [section, setSection] = useState<
    "products" | "articles" | "settings" | "orders" | "returns"
  >("products");
  const [adminArticles, setAdminArticles] = useState<AdminArticle[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminReturns, setAdminReturns] = useState<AdminReturn[]>([]);
  const [adminSettings, setAdminSettings] = useState<SiteSettings | null>(null);
  const [articleModal, setArticleModal] = useState<AdminArticle | "new" | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState("");

  async function loadAdminData() {
    const [articleData, orderData, returnData, settingsData] = await Promise.all([
      storeApi.adminArticles(),
      storeApi.adminOrders(),
      storeApi.adminReturns(),
      storeApi.adminSettings(),
    ]);
    setAdminArticles(articleData.articles);
    setAdminOrders(orderData.orders);
    setAdminReturns(returnData.returns);
    setAdminSettings(settingsData.settings);
  }

  useEffect(() => {
    if (!isAdmin) return;
    const timeout = window.setTimeout(() => {
      void loadAdminData().catch((error) => {
        setAdminMessage(error instanceof Error ? error.message : "Nie udało się wczytać panelu");
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isAdmin]);

  async function saveArticle(payload: ArticlePayload) {
    try {
      if (articleModal === "new") {
        await storeApi.createArticle(payload);
      } else if (articleModal) {
        await storeApi.updateArticle(articleModal.id, payload);
      }
      setArticleModal(null);
      await loadAdminData();
      await onContentChanged();
      setAdminMessage("Artykuł został zapisany.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Nie udało się zapisać artykułu");
    }
  }

  async function removeArticle(article: AdminArticle) {
    if (!window.confirm("Trwale usunąć artykuł „" + article.title + "”?")) return;
    try {
      await storeApi.deleteArticle(article.id);
      await loadAdminData();
      await onContentChanged();
      setAdminMessage("Artykuł został usunięty.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Nie udało się usunąć artykułu");
    }
  }

  async function changeOrderStatus(orderId: string, status: string) {
    try {
      await storeApi.updateOrderStatus(orderId, status);
      await loadAdminData();
      setAdminMessage("Status zamówienia został zmieniony.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Nie udało się zmienić statusu");
    }
  }

  async function saveReturnStatus(
    requestId: string,
    status: string,
    resolution: string,
  ) {
    try {
      await storeApi.updateReturnStatus(requestId, status, resolution);
      await loadAdminData();
      setAdminMessage("Zgłoszenie zostało zaktualizowane.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Nie udało się zmienić zgłoszenia");
    }
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <EmptyState
          icon={<ShieldCheck size={30} />}
          title="Panel wymaga konta administratora"
          text="Zaloguj się lokalnym kontem admin@greckigaj.local, aby zarządzać danymi zapisanymi w PostgreSQL."
          action={<button className="button primary" onClick={onOpenAccount}>Przejdź do logowania</button>}
        />
      </div>
    );
  }
  const visible = products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase()),
  );
  const activeOrder = adminOrders.find((order) => order.id === selectedOrder) || null;
  const activeReturn = adminReturns.find((item) => item.id === selectedReturn) || null;
  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <Logo onClick={() => window.scrollTo({ top: 0 })} />
        <nav>
          <button className={section === "products" ? "active" : ""} onClick={() => setSection("products")}>
            <Box size={18} />
            Produkty
          </button>
          <button className={section === "articles" ? "active" : ""} onClick={() => setSection("articles")}>
            <CalendarDays size={18} />
            Dziennik
          </button>
          <button className={section === "settings" ? "active" : ""} onClick={() => setSection("settings")}>
            <Pencil size={18} />
            Gaj i kontakt
          </button>
          <button className={section === "orders" ? "active" : ""} onClick={() => setSection("orders")}>
            <ShoppingBag size={18} />
            Zamówienia
          </button>
          <button className={section === "returns" ? "active" : ""} onClick={() => setSection("returns")}>
            <RotateCcw size={18} />
            Zwroty i reklamacje
          </button>
        </nav>
      </aside>
      <section className="admin-content">
        {adminMessage && <div className="admin-notice">{adminMessage}</div>}
        {section === "products" && (
          <>
        <div className="admin-heading">
          <div>
            <span className="eyebrow">Panel administracyjny</span>
            <h1>Produkty</h1>
            <p>{products.length} pozycji w katalogu</p>
          </div>
          <button className="button primary" onClick={() => onEdit("new")}>
            <Plus size={18} />
            Dodaj produkt
          </button>
        </div>
        <div className="admin-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj produktu"
            />
          </label>
          <button className="button secondary">
            <Filter size={17} />
            Filtry
          </button>
        </div>
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Kategoria</th>
                <th>Cena</th>
                <th>Stan</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className={product.softDeleted ? "muted" : ""}>
                  <td>
                    <div className="table-product">
                      <ProductVisual crop={product.crop} imageUrl={product.images?.[0]?.url} alt={product.name} />
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.unit}</small>
                      </div>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td>{formatPrice(product.price)}</td>
                  <td>
                    <span
                      className={
                        "stock-dot " +
                        (product.stock < 15
                          ? "low"
                          : product.stock < 30
                            ? "medium"
                            : "")
                      }
                    />
                    {product.stock} szt.
                  </td>
                  <td>
                    <span className={"status " + (product.softDeleted ? "hidden" : "active")}>
                      {product.softDeleted ? "Ukryty" : "Aktywny"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => onEdit(product)}
                        aria-label={"Edytuj " + product.name}
                        title="Edytuj"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onSoftDelete(product)}
                        aria-label={
                          (product.softDeleted ? "Przywróć " : "Ukryj ") +
                          product.name
                        }
                        title={product.softDeleted ? "Przywróć" : "Ukryj"}
                      >
                        {product.softDeleted ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        className="danger"
                        onClick={() => onHardDelete(product)}
                        aria-label={"Trwale usuń " + product.name}
                        title="Trwale usuń"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="retention-panel">
          <div>
            <ShieldCheck size={22} />
            <span>
              <strong>Polityka przechowywania danych</strong>
              Docelowa automatyzacja uruchamiana codziennie
            </span>
          </div>
          <div className="retention-rules">
            <span>
              <strong>3 lata</strong>
              anonimizacja danych zamówień
            </span>
            <span>
              <strong>5 lat</strong>
              dokumenty podatkowe i księgowe
            </span>
          </div>
        </div>
          </>
        )}

        {section === "articles" && (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Treści sklepu</span>
                <h1>Dziennik</h1>
                <p>{adminArticles.length} artykułów</p>
              </div>
              <button className="button primary" onClick={() => setArticleModal("new")}>
                <Plus size={18} />
                Dodaj artykuł
              </button>
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Tytuł</th>
                    <th>Kategoria</th>
                    <th>Status</th>
                    <th>Aktualizacja</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {adminArticles.map((article) => (
                    <tr key={article.id}>
                      <td><strong>{article.title}</strong></td>
                      <td>{article.category}</td>
                      <td><span className={"status " + article.status}>{article.status}</span></td>
                      <td>{new Date(article.updatedAt).toLocaleDateString("pl-PL")}</td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => setArticleModal(article)} aria-label={"Edytuj " + article.title} title="Edytuj">
                            <Pencil size={16} />
                          </button>
                          <button className="danger" onClick={() => void removeArticle(article)} aria-label={"Usuń " + article.title} title="Usuń">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {section === "settings" && (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Treści stałe</span>
                <h1>Nasz gaj i kontakt</h1>
                <p>Zmiany są od razu widoczne w sklepie.</p>
              </div>
            </div>
            {adminSettings && (
              <form
                className="admin-settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const settings = {
                    groveTitle: String(form.get("groveTitle")),
                    groveDescription: String(form.get("groveDescription")),
                    groveSecondaryDescription: String(form.get("groveSecondaryDescription")),
                    contactPhone: String(form.get("contactPhone")),
                  };
                  void storeApi.updateSettings(settings).then(async (result) => {
                    setAdminSettings(result.settings);
                    await onContentChanged();
                    setAdminMessage("Treść gaju i numer telefonu zostały zapisane.");
                  }).catch((error) => {
                    setAdminMessage(error instanceof Error ? error.message : "Nie udało się zapisać ustawień");
                  });
                }}
              >
                <section>
                  <span className="eyebrow">Nasz gaj</span>
                  <label>
                    Nagłówek historii
                    <input name="groveTitle" defaultValue={adminSettings.groveTitle} required />
                  </label>
                  <label>
                    Pierwszy opis
                    <textarea name="groveDescription" rows={6} defaultValue={adminSettings.groveDescription} required />
                  </label>
                  <label>
                    Drugi opis
                    <textarea name="groveSecondaryDescription" rows={5} defaultValue={adminSettings.groveSecondaryDescription} required />
                  </label>
                </section>
                <section>
                  <span className="eyebrow">Kontakt</span>
                  <label>
                    Numer telefonu
                    <input name="contactPhone" defaultValue={adminSettings.contactPhone} required />
                  </label>
                  <p className="field-help">Numer zostanie użyty w linku telefonicznym na stronie Kontakt.</p>
                </section>
                <button className="button primary" type="submit"><Save size={17} /> Zapisz zmiany</button>
              </form>
            )}
          </>
        )}

        {section === "orders" && (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Sprzedaż</span>
                <h1>Zamówienia klientów</h1>
                <p>{adminOrders.length} wszystkich zamówień</p>
              </div>
            </div>
            <div className="admin-master-detail">
              <div className="admin-list">
                {adminOrders.map((order) => (
                  <button
                    key={order.id}
                    className={selectedOrder === order.id ? "active" : ""}
                    onClick={() => setSelectedOrder(order.id)}
                  >
                    <span><strong>{order.number}</strong><small>{order.firstName} {order.lastName}</small></span>
                    <span><strong>{formatPrice(order.total)}</strong><small>{order.status}</small></span>
                  </button>
                ))}
              </div>
              <div className="admin-detail">
                {!activeOrder ? (
                  <EmptyState icon={<ShoppingBag size={28} />} title="Wybierz zamówienie" text="Zobaczysz dane klienta, produkty, dostawę i historię statusów." />
                ) : (
                  <>
                    <div className="admin-detail-head">
                      <div><span className="eyebrow">{activeOrder.number}</span><h2>{activeOrder.firstName} {activeOrder.lastName}</h2></div>
                      <select value={activeOrder.status} onChange={(event) => void changeOrderStatus(activeOrder.id, event.target.value)}>
                        <option value="awaiting_payment">Oczekuje na płatność</option>
                        <option value="paid">Opłacone</option>
                        <option value="processing">W realizacji</option>
                        <option value="shipped">Wysłane</option>
                        <option value="delivered">Doręczone</option>
                        <option value="cancelled">Anulowane</option>
                        <option value="returned">Zwrócone</option>
                      </select>
                    </div>
                    <div className="admin-detail-grid">
                      <div><small>E-mail</small><strong>{activeOrder.guestEmail || activeOrder.user?.email}</strong></div>
                      <div><small>Telefon</small><strong>{activeOrder.phone || "Brak"}</strong></div>
                      <div><small>Adres</small><strong>{activeOrder.street}, {activeOrder.postalCode} {activeOrder.city}</strong></div>
                      <div><small>Dostawa</small><strong>{activeOrder.shipment?.method === "locker" ? `Paczkomat ${activeOrder.shipment.lockerCode}` : "Kurier InPost"}</strong></div>
                      <div><small>Płatność</small><strong>{activeOrder.payment?.status || "Brak"}</strong></div>
                      <div><small>Razem</small><strong>{formatPrice(activeOrder.total)}</strong></div>
                    </div>
                    <div className="admin-items">
                      {activeOrder.items.map((item) => (
                        <div key={item.id}><span>{item.productName} · {item.productUnit} × {item.quantity}</span><strong>{formatPrice(item.lineTotal)}</strong></div>
                      ))}
                    </div>
                    <div className="admin-history">
                      <h3>Historia statusów</h3>
                      {activeOrder.statusHistory.map((entry) => (
                        <div key={entry.id}><span>{entry.status}</span><small>{new Date(entry.createdAt).toLocaleString("pl-PL")} · {entry.note}</small></div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {section === "returns" && (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Obsługa posprzedażowa</span>
                <h1>Zwroty i reklamacje</h1>
                <p>{adminReturns.length} wszystkich zgłoszeń</p>
              </div>
            </div>
            <div className="admin-master-detail">
              <div className="admin-list">
                {adminReturns.length === 0 && <p className="admin-empty-list">Brak zgłoszeń.</p>}
                {adminReturns.map((item) => (
                  <button key={item.id} className={selectedReturn === item.id ? "active" : ""} onClick={() => setSelectedReturn(item.id)}>
                    <span><strong>{item.kind}</strong><small>{item.order.number} · {item.email}</small></span>
                    <span><small>{item.status}</small></span>
                  </button>
                ))}
              </div>
              <div className="admin-detail">
                {!activeReturn ? (
                  <EmptyState icon={<RotateCcw size={28} />} title="Wybierz zgłoszenie" text="Tutaj zobaczysz opis klienta i zmienisz sposób obsługi." />
                ) : (
                  <form
                    key={activeReturn.id}
                    className="return-admin-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void saveReturnStatus(activeReturn.id, String(form.get("status")), String(form.get("resolution")));
                    }}
                  >
                    <div className="admin-detail-head"><div><span className="eyebrow">{activeReturn.order.number}</span><h2>{activeReturn.kind}</h2></div></div>
                    <div className="admin-detail-grid">
                      <div><small>Klient</small><strong>{activeReturn.user ? `${activeReturn.user.firstName} ${activeReturn.user.lastName}` : activeReturn.email}</strong></div>
                      <div><small>E-mail</small><strong>{activeReturn.email}</strong></div>
                      <div><small>Wartość zamówienia</small><strong>{formatPrice(activeReturn.order.total)}</strong></div>
                      <div><small>Data zgłoszenia</small><strong>{new Date(activeReturn.createdAt).toLocaleString("pl-PL")}</strong></div>
                    </div>
                    <div className="request-description"><small>Opis klienta</small><p>{activeReturn.description}</p></div>
                    <label>Status<select name="status" defaultValue={activeReturn.status}><option value="submitted">Nowe</option><option value="reviewing">Analizowane</option><option value="accepted">Uznane</option><option value="rejected">Odrzucone</option><option value="completed">Zakończone</option></select></label>
                    <label>Decyzja / odpowiedź<textarea name="resolution" rows={5} defaultValue={activeReturn.resolution || ""} placeholder="Notatka dla obsługi i treść rozstrzygnięcia" /></label>
                    <button className="button primary" type="submit"><Save size={17} /> Zapisz status</button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      {articleModal && (
        <AdminArticleModal article={articleModal} onClose={() => setArticleModal(null)} onSave={saveArticle} />
      )}
    </div>
  );
}

function AdminArticleModal({
  article,
  onClose,
  onSave,
}: {
  article: AdminArticle | "new";
  onClose: () => void;
  onSave: (payload: ArticlePayload) => Promise<void>;
}) {
  const existing = article === "new" ? null : article;
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || "");

  function readImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <form
        className="admin-article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSave({
            title: String(form.get("title")),
            category: String(form.get("category")),
            excerpt: String(form.get("excerpt")),
            body: String(form.get("body")),
            imageUrl,
            crop: String(form.get("crop")) as Product["crop"],
            readingTimeMinutes: Number(form.get("readingTimeMinutes")),
            status: String(form.get("status")) as AdminArticle["status"],
          });
        }}
      >
        <div className="drawer-head">
          <div><span className="eyebrow">Dziennik</span><h2>{existing ? "Edytuj artykuł" : "Nowy artykuł"}</h2></div>
          <button className="icon-action" type="button" onClick={onClose} aria-label="Zamknij"><X size={20} /></button>
        </div>
        <div className="article-editor-grid">
          <div className="article-fields">
            <label>Tytuł<input name="title" defaultValue={existing?.title} required /></label>
            <div className="form-row">
              <label>Kategoria<input name="category" defaultValue={existing?.category || "Odżywianie"} required /></label>
              <label>Czas czytania<input name="readingTimeMinutes" type="number" min="1" max="120" defaultValue={existing?.readingTimeMinutes || 5} required /></label>
            </div>
            <label>Zajawka<textarea name="excerpt" rows={3} defaultValue={existing?.excerpt} required /></label>
            <label>Treść artykułu<textarea name="body" rows={12} defaultValue={existing?.body} required /></label>
          </div>
          <aside className="article-media-panel">
            <ProductVisual crop={(existing?.imageCrop || "oil") as Product["crop"]} imageUrl={imageUrl} alt="Podgląd artykułu" />
            <label>Wczytaj zdjęcie<input type="file" accept="image/*" onChange={readImage} /></label>
            <label>lub adres obrazu<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." /></label>
            <label>Motyw zastępczy<select name="crop" defaultValue={existing?.imageCrop || "oil"}><option value="oil">Oliwa</option><option value="olives">Oliwki</option><option value="honey">Miód</option><option value="oregano">Zioła</option></select></label>
            <label>Status<select name="status" defaultValue={existing?.status || "draft"}><option value="draft">Szkic</option><option value="published">Opublikowany</option><option value="archived">Archiwalny</option></select></label>
          </aside>
        </div>
        <div className="modal-form-actions">
          <button className="button secondary" type="button" onClick={onClose}>Anuluj</button>
          <button className="button primary" type="submit"><Save size={17} /> Zapisz artykuł</button>
        </div>
      </form>
    </div>
  );
}

function CartDrawer({
  lines,
  subtotal,
  onClose,
  onUpdate,
  onCheckout,
  onShop,
}: {
  lines: (CartLine & { product: Product })[];
  subtotal: number;
  onClose: () => void;
  onUpdate: (productId: number, quantity: number) => void;
  onCheckout: () => void;
  onShop: () => void;
}) {
  return (
    <div className="overlay drawer-overlay" onMouseDown={onClose}>
      <aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>Twój koszyk</h2>
            <span>{lines.reduce((sum, line) => sum + line.quantity, 0)} produktów</span>
          </div>
          <button className="icon-action" onClick={onClose} aria-label="Zamknij koszyk">
            <X size={20} />
          </button>
        </div>
        {lines.length ? (
          <>
            <div className="cart-lines">
              {lines.map((line) => (
                <div className="cart-line" key={line.productId}>
                  <ProductVisual crop={line.product.crop} />
                  <div className="cart-line-info">
                    <strong>{line.product.shortName}</strong>
                    <small>{line.product.unit}</small>
                    <div className="cart-line-bottom">
                      <QuantityControl
                        compact
                        value={line.quantity}
                        onChange={(quantity) => onUpdate(line.productId, quantity)}
                      />
                      <strong>
                        {formatPrice(line.product.price * line.quantity)}
                      </strong>
                    </div>
                  </div>
                  <button
                    className="remove-line"
                    onClick={() => onUpdate(line.productId, 0)}
                    aria-label={"Usuń " + line.product.name}
                    title="Usuń"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="free-shipping">
              <Truck size={18} />
              {subtotal >= 199 ? (
                <span>
                  Masz <strong>darmową dostawę</strong>
                </span>
              ) : (
                <span>
                  Do darmowej dostawy brakuje{" "}
                  <strong>{formatPrice(199 - subtotal)}</strong>
                </span>
              )}
              <div>
                <span style={{ width: Math.min(100, (subtotal / 199) * 100) + "%" }} />
              </div>
            </div>
            <div className="drawer-summary">
              <div>
                <span>Wartość produktów</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <small>Dostawa zostanie obliczona w kolejnym kroku.</small>
              <button className="button primary full" onClick={onCheckout}>
                Przejdź do zamówienia
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<ShoppingBag size={30} />}
            title="Koszyk jest pusty"
            text="Dodaj coś dobrego z naszej greckiej spiżarni."
            action={
              <button className="button primary" onClick={onShop}>
                Zobacz produkty
              </button>
            }
          />
        )}
      </aside>
    </div>
  );
}

function ProductModal({
  product,
  quantity,
  setQuantity,
  onClose,
  onAdd,
}: {
  product: Product;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <section className="product-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Zamknij">
          <X size={20} />
        </button>
        <ProductVisual
          crop={product.crop}
          className="product-modal-photo"
          imageUrl={product.images?.[0]?.url}
          alt={product.images?.[0]?.alt || product.name}
        />
        <div className="product-modal-copy">
          <span className="eyebrow">{product.category}</span>
          <h2>{product.name}</h2>
          <div className="modal-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.compareAt && <del>{formatPrice(product.compareAt)}</del>}
            <span>{product.unit}</span>
          </div>
          <p>{product.description}</p>
          <div className="tag-row">
            {product.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <dl className="product-details">
            <div>
              <dt>Pochodzenie</dt>
              <dd>{product.origin || "Grecja"}</dd>
            </div>
            <div>
              <dt>Skład</dt>
              <dd>
                {product.ingredients ||
                  (product.category === "Oliwa"
                    ? "100% oliwa z oliwek"
                    : "100% naturalnych składników")}
              </dd>
            </div>
            {product.allergens && (
              <div>
                <dt>Alergeny</dt>
                <dd>{product.allergens}</dd>
              </div>
            )}
            <div>
              <dt>Dostępność</dt>
              <dd>{product.stock > 0 ? "W magazynie w Polsce" : "Brak"}</dd>
            </div>
          </dl>
          <div className="modal-buy">
            <QuantityControl value={quantity} onChange={setQuantity} />
            <button className="button primary" onClick={onAdd}>
              <ShoppingBag size={18} />
              Dodaj · {formatPrice(product.price * quantity)}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Checkout({
  step,
  setStep,
  lines,
  subtotal,
  deliveryCost,
  total,
  delivery,
  setDelivery,
  locker,
  customer,
  setCustomer,
  error,
  orderPlaced,
  orderNumber,
  onNext,
  onPlaceOrder,
  onClose,
  onOpenLocker,
  onNavigateAccount,
}: {
  step: number;
  setStep: (step: number) => void;
  lines: (CartLine & { product: Product })[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  delivery: "locker" | "courier";
  setDelivery: (delivery: "locker" | "courier") => void;
  locker: (typeof parcelLockers)[number];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    zip: string;
    city: string;
  };
  setCustomer: (customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    zip: string;
    city: string;
  }) => void;
  error: string;
  orderPlaced: boolean;
  orderNumber: string;
  onNext: () => void;
  onPlaceOrder: () => Promise<void>;
  onClose: () => void;
  onOpenLocker: () => void;
  onNavigateAccount: () => void;
}) {
  const labels = ["Dane", "Dostawa", "Płatność", "Podsumowanie"];
  if (orderPlaced) {
    return (
      <div className="checkout-shell">
        <div className="checkout-success">
          <span className="success-icon">
            <Check size={34} />
          </span>
          <span className="eyebrow">Dziękujemy</span>
          <h1>Zamówienie jest przyjęte</h1>
          <p>
            Numer <strong>{orderNumber}</strong> wysłaliśmy na adres{" "}
            <strong>{customer.email}</strong>.
          </p>
          <div className="transfer-card success-transfer">
            <div>
              <small>Do zapłaty</small>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p>
              Wykonaj przelew w ciągu 3 dni. W tytule wpisz:
              <strong> {orderNumber}</strong>
            </p>
            <code>12 1140 2004 0000 3002 0135 8765</code>
            <small>Rachunek demonstracyjny — nie wykonuj prawdziwego przelewu.</small>
          </div>
          <div className="success-actions">
            <button className="button primary" onClick={onNavigateAccount}>
              Zobacz zamówienie
            </button>
            <button className="button secondary" onClick={onClose}>
              Wróć do sklepu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-shell">
      <header className="checkout-header">
        <Logo onClick={onClose} />
        <button className="checkout-close" onClick={onClose}>
          <X size={18} />
          Zamknij
        </button>
      </header>
      <div className="checkout-progress">
        {labels.map((label, index) => (
          <button
            key={label}
            className={
              index === step ? "active" : index < step ? "done" : ""
            }
            onClick={() => index < step && setStep(index)}
          >
            <span>{index < step ? <Check size={14} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <div className="checkout-layout">
        <section className="checkout-main">
          {step === 0 && (
            <div className="checkout-step">
              <span className="eyebrow">Krok 1 z 4</span>
              <h1>Dane zamawiającego</h1>
              <div className="guest-choice">
                <button className="active">Kupuję bez konta</button>
                <button>Mam konto</button>
              </div>
              <div className="form-grid">
                <label>
                  Imię*
                  <input
                    value={customer.firstName}
                    onChange={(event) =>
                      setCustomer({ ...customer, firstName: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Nazwisko*
                  <input
                    value={customer.lastName}
                    onChange={(event) =>
                      setCustomer({ ...customer, lastName: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  E-mail*
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(event) =>
                      setCustomer({ ...customer, email: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Telefon
                  <input
                    value={customer.phone}
                    onChange={(event) =>
                      setCustomer({ ...customer, phone: event.target.value })
                    }
                  />
                </label>
                <label className="span-two">
                  Ulica i numer*
                  <input
                    value={customer.street}
                    onChange={(event) =>
                      setCustomer({ ...customer, street: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Kod pocztowy*
                  <input
                    value={customer.zip}
                    placeholder="00-000"
                    onChange={(event) =>
                      setCustomer({ ...customer, zip: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Miejscowość*
                  <input
                    value={customer.city}
                    onChange={(event) =>
                      setCustomer({ ...customer, city: event.target.value })
                    }
                    required
                  />
                </label>
              </div>
              {error && (
                <div className="form-error">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="checkout-step">
              <span className="eyebrow">Krok 2 z 4</span>
              <h1>Wybierz dostawę</h1>
              <div className="delivery-options">
                <button
                  className={delivery === "locker" ? "active" : ""}
                  onClick={() => setDelivery("locker")}
                >
                  <span className="delivery-icon inpost">24/7</span>
                  <span>
                    <strong>Paczkomat InPost</strong>
                    <small>Odbiór w wybranym punkcie</small>
                  </span>
                  <b>{subtotal >= 199 ? "0 zł" : "12,99 zł"}</b>
                  <i>{delivery === "locker" && <Check size={14} />}</i>
                </button>
                <button
                  className={delivery === "courier" ? "active" : ""}
                  onClick={() => setDelivery("courier")}
                >
                  <span className="delivery-icon">
                    <Truck size={22} />
                  </span>
                  <span>
                    <strong>Kurier InPost</strong>
                    <small>Dostawa pod wskazany adres</small>
                  </span>
                  <b>{subtotal >= 199 ? "0 zł" : "16,99 zł"}</b>
                  <i>{delivery === "courier" && <Check size={14} />}</i>
                </button>
              </div>
              {delivery === "locker" && (
                <div className="selected-locker">
                  <MapPin size={20} />
                  <span>
                    <small>Wybrany Paczkomat</small>
                    <strong>{locker.code}</strong>
                    {locker.address}
                  </span>
                  <button className="text-link" onClick={onOpenLocker}>
                    Zmień
                  </button>
                </div>
              )}
              {delivery === "courier" && (
                <div className="address-preview">
                  <MapPin size={20} />
                  <span>
                    <small>Adres dostawy</small>
                    <strong>
                      {customer.firstName} {customer.lastName}
                    </strong>
                    {customer.street}, {customer.zip} {customer.city}
                  </span>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="checkout-step">
              <span className="eyebrow">Krok 3 z 4</span>
              <h1>Forma płatności</h1>
              <div className="payment-option active">
                <span>
                  <span className="bank-icon">PLN</span>
                  <span>
                    <strong>Przelew tradycyjny</strong>
                    <small>Na wpłatę czekamy do 3 dni kalendarzowych</small>
                  </span>
                </span>
                <i>
                  <Check size={14} />
                </i>
              </div>
              <div className="transfer-card">
                <small>Dane do przelewu otrzymasz również e-mailem</small>
                <dl>
                  <div>
                    <dt>Odbiorca</dt>
                    <dd>Grecki Gaj sp. z o.o.</dd>
                  </div>
                  <div>
                    <dt>Numer rachunku</dt>
                    <dd>12 1140 2004 0000 3002 0135 8765</dd>
                  </div>
                </dl>
                <p>
                  Rachunek demonstracyjny. Zamówienie trafi do realizacji po
                  zaksięgowaniu wpłaty.
                </p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="checkout-step">
              <span className="eyebrow">Krok 4 z 4</span>
              <h1>Sprawdź zamówienie</h1>
              <div className="checkout-review">
                <div>
                  <span>
                    <strong>Dane i adres</strong>
                    <button onClick={() => setStep(0)}>Edytuj</button>
                  </span>
                  <p>
                    {customer.firstName} {customer.lastName}
                    <br />
                    {customer.street}
                    <br />
                    {customer.zip} {customer.city}
                    <br />
                    {customer.email}
                  </p>
                </div>
                <div>
                  <span>
                    <strong>Dostawa</strong>
                    <button onClick={() => setStep(1)}>Edytuj</button>
                  </span>
                  <p>
                    {delivery === "locker"
                      ? "Paczkomat InPost " + locker.code + ", " + locker.address
                      : "Kurier InPost na wskazany adres"}
                  </p>
                </div>
                <div>
                  <span>
                    <strong>Płatność</strong>
                    <button onClick={() => setStep(2)}>Edytuj</button>
                  </span>
                  <p>Przelew tradycyjny, termin płatności 3 dni.</p>
                </div>
              </div>
              <label className="check-field consent">
                <input type="checkbox" required />
                <span>
                  Akceptuję regulamin sklepu i potwierdzam zapoznanie się z
                  polityką prywatności oraz prawem odstąpienia od umowy.
                </span>
              </label>
            </div>
          )}
          <div className="checkout-nav">
            {step > 0 && (
              <button className="text-link" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={17} />
                Wstecz
              </button>
            )}
            {step < 3 ? (
              <button className="button primary" onClick={onNext}>
                Dalej
                <ArrowRight size={18} />
              </button>
            ) : (
              <button className="button primary order-button" onClick={onPlaceOrder}>
                Zamawiam z obowiązkiem zapłaty
              </button>
            )}
          </div>
        </section>
        <aside className="checkout-summary">
          <h2>Twoje zamówienie</h2>
          <div className="summary-lines">
            {lines.map((line) => (
              <div key={line.productId}>
                <ProductVisual crop={line.product.crop} />
                <span>
                  <strong>{line.product.shortName}</strong>
                  <small>
                    {line.quantity} × {line.product.unit}
                  </small>
                </span>
                <b>{formatPrice(line.product.price * line.quantity)}</b>
              </div>
            ))}
          </div>
          <dl className="totals">
            <div>
              <dt>Produkty</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Dostawa</dt>
              <dd>{deliveryCost ? formatPrice(deliveryCost) : "Bezpłatnie"}</dd>
            </div>
            <div>
              <dt>Razem</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <div className="secure-note">
            <ShieldCheck size={18} />
            Dane przesyłane są bezpiecznie
          </div>
        </aside>
      </div>
    </div>
  );
}

function LockerPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (locker: (typeof parcelLockers)[number]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <section className="locker-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="locker-head">
          <div>
            <span className="inpost-word">inPost</span>
            <h2>Wybierz Paczkomat</h2>
          </div>
          <button className="icon-action" onClick={onClose} aria-label="Zamknij">
            <X size={20} />
          </button>
        </div>
        <label className="search-field locker-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Miasto, ulica lub kod pocztowy"
          />
        </label>
        <div className="locker-layout">
          <div className="locker-list">
            {parcelLockers
              .filter((item) =>
                (item.code + item.address)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((item) => (
                <button
                  className={selected === item.code ? "active" : ""}
                  key={item.code}
                  onClick={() => onSelect(item)}
                >
                  <span className="locker-symbol">24/7</span>
                  <span>
                    <strong>{item.code}</strong>
                    <small>{item.address}</small>
                    <em>Dostępny {item.hours}</em>
                  </span>
                  <i>{selected === item.code && <Check size={14} />}</i>
                </button>
              ))}
          </div>
          <div className="map-demo">
            <div className="map-street one" />
            <div className="map-street two" />
            <div className="map-street three" />
            {parcelLockers.map((item, index) => (
              <button
                key={item.code}
                className={"map-pin pin-" + (index + 1)}
                onClick={() => onSelect(item)}
                aria-label={item.code}
              >
                <MapPin size={22} fill="currentColor" />
              </button>
            ))}
            <span className="map-label a">Świętokrzyska</span>
            <span className="map-label b">Marszałkowska</span>
          </div>
        </div>
        <div className="integration-note">
          Lokalny wybór punktu zastępuje Geowidget do czasu podania klucza InPost.
        </div>
      </section>
    </div>
  );
}

function SearchOverlay({
  value,
  setValue,
  products,
  onClose,
  onShowResults,
  onOpenProduct,
}: {
  value: string;
  setValue: (value: string) => void;
  products: Product[];
  onClose: () => void;
  onShowResults: () => void;
  onOpenProduct: (product: Product) => void;
}) {
  const results = products
    .filter((product) =>
      product.name.toLowerCase().includes(value.toLowerCase()),
    )
    .slice(0, 4);
  return (
    <div className="search-overlay">
      <div className="search-overlay-top">
        <Logo onClick={onClose} />
        <label>
          <Search size={21} />
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Szukaj oliwy, ziół, miodu..."
            onKeyDown={(event) => event.key === "Enter" && onShowResults()}
          />
        </label>
        <button className="icon-action" onClick={onClose} aria-label="Zamknij">
          <X size={21} />
        </button>
      </div>
      <div className="search-results">
        <span>{value ? "Podpowiedzi" : "Popularne produkty"}</span>
        {(value ? results : products.slice(0, 4)).map((product) => (
          <button key={product.id} onClick={() => onOpenProduct(product)}>
            <ProductVisual crop={product.crop} />
            <span>
              <strong>{product.name}</strong>
              <small>
                {product.unit} · {formatPrice(product.price)}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
        {value && (
          <button className="show-all-results" onClick={onShowResults}>
            Pokaż wszystkie wyniki
            <ArrowRight size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

function ArticleModal({
  article,
  onClose,
}: {
  article: ArticleContent;
  onClose: () => void;
}) {
  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <article className="article-reader" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Zamknij artykuł"><X size={20} /></button>
        <ProductVisual crop={article.crop} imageUrl={article.imageUrl} alt={article.title} className="article-reader-image" />
        <div className="article-reader-copy">
          <span className="article-meta">{article.category} · {article.time}</span>
          <h1>{article.title}</h1>
          <p className="article-lead">{article.excerpt}</p>
          <div className="article-body">
            {(article.body || article.excerpt).split(/\n+/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function AdminProductModal({
  product,
  onClose,
  onSave,
}: {
  product: Product | "new";
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const existing = product === "new" ? null : product;
  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <form
        className="admin-product-modal"
        onSubmit={onSave}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Katalog</span>
            <h2>{existing ? "Edytuj produkt" : "Nowy produkt"}</h2>
          </div>
          <button className="icon-action" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label className="span-two">
            Pełna nazwa
            <input name="name" defaultValue={existing?.name} required />
          </label>
          <label>
            Krótka nazwa
            <input name="shortName" defaultValue={existing?.shortName} required />
          </label>
          <label>
            Kategoria
            <select name="category" defaultValue={existing?.category || "Oliwa"}>
              <option>Oliwa</option>
              <option>Oliwki</option>
              <option>Miody</option>
              <option>Zioła</option>
            </select>
          </label>
          <label className="span-two">
            Opis
            <textarea
              name="description"
              rows={4}
              defaultValue={existing?.description}
              required
            />
          </label>
          <label className="span-two">
            Skład produktu
            <textarea name="ingredients" rows={2} defaultValue={existing?.ingredients} />
          </label>
          <label>
            Alergeny
            <input name="allergens" defaultValue={existing?.allergens} placeholder="np. może zawierać orzechy" />
          </label>
          <label>
            Kraj / region pochodzenia
            <input name="origin" defaultValue={existing?.origin || "Grecja"} required />
          </label>
          <label>
            Cena sprzedaży brutto
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={existing?.price}
              required
            />
          </label>
          <label>
            Cena przed obniżką
            <input
              name="compareAt"
              type="number"
              step="0.01"
              min="0"
              defaultValue={existing?.compareAt}
              placeholder="Opcjonalnie"
            />
          </label>
          <label>
            Wariant / pojemność
            <input name="unit" defaultValue={existing?.unit} required />
          </label>
          <label>
            Stan magazynowy
            <input
              name="stock"
              type="number"
              min="0"
              defaultValue={existing?.stock}
              required
            />
          </label>
          <label>
            Typ zdjęcia zastępczego
            <select name="crop" defaultValue={existing?.crop || "oil"}>
              <option value="oil">Oliwa</option>
              <option value="olives">Oliwki</option>
              <option value="honey">Miód</option>
              <option value="oregano">Oregano</option>
            </select>
          </label>
          <label className="span-two">
            Adres zdjęcia produktu
            <input
              name="imageUrl"
              defaultValue={existing?.images?.[0]?.url}
              placeholder="https://... albo /images/nazwa.jpg"
            />
          </label>
          <label className="span-two">
            Tagi (oddziel przecinkami)
            <input name="tags" defaultValue={existing?.tags.join(", ")} />
          </label>
          <label className="check-field span-two">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={existing?.featured}
            />
            <span>Pokazuj produkt na stronie głównej</span>
          </label>
        </div>
        <div className="modal-form-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Anuluj
          </button>
          <button className="button primary" type="submit">
            <Save size={17} />
            Zapisz produkt
          </button>
        </div>
      </form>
    </div>
  );
}

function LegalModal({
  page,
  onClose,
}: {
  page: Exclude<LegalPage, null>;
  onClose: () => void;
}) {
  const content = {
    privacy: {
      title: "Polityka prywatności",
      intro:
        "Poniższa treść jest kompletnym szkieletem dokumentu. Dane spółki, dostawców i podstawy przetwarzania trzeba potwierdzić przed publikacją.",
      sections: [
        [
          "Administrator danych",
          "Administratorem danych jest Grecki Gaj sp. z o.o. Kontakt w sprawach prywatności: rodo@greckigaj.pl.",
        ],
        [
          "Cele i podstawy przetwarzania",
          "Dane przetwarzamy w celu realizacji zamówień, prowadzenia konta, obsługi reklamacji, rozliczeń podatkowych, odpowiedzi na wiadomości oraz — po dobrowolnej zgodzie — newslettera i analityki.",
        ],
        [
          "Odbiorcy danych",
          "Dane mogą otrzymać dostawcy hostingu, poczty, księgowości, InPost oraz podmioty zapewniające bezpieczeństwo i analitykę, wyłącznie w niezbędnym zakresie.",
        ],
        [
          "Okres przechowywania",
          "Dane operacyjne zamówień anonimizujemy po 3 latach. Dokumenty księgowe i podatkowe przechowujemy przez okres wymagany prawem, co do zasady 5 lat liczonych zgodnie z przepisami podatkowymi.",
        ],
        [
          "Twoje prawa",
          "Masz prawo dostępu, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu i złożenia skargi do Prezesa UODO.",
        ],
        [
          "Pliki cookies",
          "Niezbędne cookies utrzymują koszyk i sesję. Analityczne oraz marketingowe uruchamiamy dopiero po zgodzie, którą można później zmienić.",
        ],
      ],
    },
    terms: {
      title: "Regulamin sklepu",
      intro:
        "Szkielet regulaminu do uzupełnienia pełnymi danymi sprzedawcy i weryfikacji prawnej przed startem sprzedaży.",
      sections: [
        [
          "Sprzedawca i kontakt",
          "Sklep prowadzi Grecki Gaj sp. z o.o. Dane rejestrowe, adres, NIP, KRS, e-mail i telefon zostaną wpisane przed uruchomieniem sprzedaży.",
        ],
        [
          "Składanie zamówień",
          "Zamówienia można składać bez konta lub po zalogowaniu. Umowa zostaje zawarta po kliknięciu przycisku „Zamawiam z obowiązkiem zapłaty” i otrzymaniu potwierdzenia.",
        ],
        [
          "Cena i płatność",
          "Ceny są cenami brutto w PLN. Płatność przelewem tradycyjnym powinna nastąpić w ciągu 3 dni. Brak wpłaty może skutkować anulowaniem zamówienia.",
        ],
        [
          "Dostawa",
          "Zamówienia wysyłamy wyłącznie na terenie Polski z magazynu w Polsce. Dostępne formy to Paczkomat InPost i kurier InPost.",
        ],
        [
          "Produkty spożywcze",
          "Skład, alergeny, masa, pochodzenie i termin przydatności są prezentowane przy produkcie oraz na etykiecie. Klient powinien przechowywać produkt zgodnie z zaleceniami.",
        ],
      ],
    },
    returns: {
      title: "Zwroty i reklamacje",
      intro:
        "Zwrot i reklamacja to dwa niezależne uprawnienia. Zgłoszenie można wysłać z konta klienta lub e-mailem.",
      sections: [
        [
          "Odstąpienie od umowy",
          "Konsument może odstąpić od umowy zawartej online w ciągu 14 dni od otrzymania towaru, bez podawania przyczyny. Po złożeniu oświadczenia ma kolejne 14 dni na odesłanie produktu.",
        ],
        [
          "Wyjątki dla żywności",
          "Prawo odstąpienia może nie przysługiwać m.in. przy szybko psujących się produktach albo zapieczętowanych towarach, których po otwarciu nie można zwrócić ze względów higienicznych. Każdy przypadek wymaga oceny konkretnego produktu.",
        ],
        [
          "Reklamacja",
          "Jeżeli towar jest niezgodny z umową, można żądać naprawy lub wymiany, a w określonych sytuacjach obniżenia ceny albo odstąpienia od umowy. Odpowiadamy na reklamację w ciągu 14 dni.",
        ],
        [
          "Uszkodzenie przesyłki",
          "Zrób zdjęcia opakowania i produktu, a następnie wyślij zgłoszenie z numerem zamówienia. Brak protokołu kurierskiego nie wyłącza prawa do reklamacji.",
        ],
        [
          "Adres zwrotu",
          "Adres i instrukcję wysyłki przekażemy po rejestracji zgłoszenia. Nie wysyłaj przesyłki pobraniowej bez wcześniejszego uzgodnienia.",
        ],
      ],
    },
  }[page];

  return (
    <div className="overlay modal-overlay" onMouseDown={onClose}>
      <section className="legal-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Dokumenty sklepu</span>
            <h2>{content.title}</h2>
          </div>
          <button className="icon-action" onClick={onClose} aria-label="Zamknij">
            <X size={20} />
          </button>
        </div>
        <div className="legal-content">
          <p className="legal-intro">{content.intro}</p>
          {content.sections.map(([title, text]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function CookieBanner({
  onAccept,
  onEssential,
  onPrivacy,
}: {
  onAccept: () => void;
  onEssential: () => void;
  onPrivacy: () => void;
}) {
  return (
    <div className="cookie-banner">
      <div className="cookie-icon">
        <ShieldCheck size={22} />
      </div>
      <div>
        <strong>Twój wybór ma znaczenie</strong>
        <p>
          Niezbędne pliki utrzymują koszyk. Pozostałe pomagają nam ulepszać
          sklep i włączymy je dopiero za Twoją zgodą.{" "}
          <button onClick={onPrivacy}>Polityka prywatności</button>
        </p>
      </div>
      <div className="cookie-actions">
        <button className="button secondary" onClick={onEssential}>
          Tylko niezbędne
        </button>
        <button className="button primary" onClick={onAccept}>
          Akceptuję wszystkie
        </button>
      </div>
    </div>
  );
}

function Footer({
  onNavigate,
  onLegal,
}: {
  onNavigate: (view: View) => void;
  onLegal: (page: LegalPage) => void;
}) {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Logo onClick={() => onNavigate("home")} />
          <p>
            Rodzinne produkty z Grecji, przechowywane i wysyłane z Polski.
          </p>
          <div className="social-row">
            <button aria-label="Instagram">
              <AtSign size={18} />
            </button>
            <button aria-label="Facebook">
              <MessageCircle size={18} />
            </button>
          </div>
        </div>
        <div>
          <strong>Zakupy</strong>
          <button onClick={() => onNavigate("shop")}>Wszystkie produkty</button>
          <button onClick={() => onNavigate("account")}>Moje konto</button>
          <button onClick={() => onNavigate("account")}>Historia zamówień</button>
          <button onClick={() => onNavigate("contact")}>Dostawa i kontakt</button>
        </div>
        <div>
          <strong>O nas</strong>
          <button onClick={() => onNavigate("grove")}>Nasz gaj</button>
          <button onClick={() => onNavigate("journal")}>Dziennik</button>
          <button onClick={() => onNavigate("contact")}>Kontakt</button>
          <button onClick={() => onNavigate("admin")}>Panel administracyjny</button>
        </div>
        <div>
          <strong>Informacje</strong>
          <button onClick={() => onLegal("terms")}>Regulamin sklepu</button>
          <button onClick={() => onLegal("privacy")}>Polityka prywatności</button>
          <button onClick={() => onLegal("returns")}>Zwroty i reklamacje</button>
          <span>Płatność: przelew tradycyjny</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Grecki Gaj. Wszystkie prawa zastrzeżone.</span>
        <span>Produkty z Grecji · wysyłka z Polski</span>
      </div>
    </footer>
  );
}
