import React from "react";
import ReactDOM from "react-dom/client";
import {
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  Loader2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2
} from "lucide-react";
import "./styles.css";

type User = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "CASHIER";
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  priceCents: number;
  stock: number;
  active: boolean;
};

type Sale = {
  id: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
};

type CartLine = {
  product: Product;
  quantity: number;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

function formatMoney(cents: number) {
  return currency.format(cents / 100);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload as T;
}

function App() {
  const [token, setToken] = React.useState(
    () => localStorage.getItem("pos_token") ?? ""
  );
  const [user, setUser] = React.useState<User | null>(() => {
    const stored = localStorage.getItem("pos_user");
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [products, setProducts] = React.useState<Product[]>([]);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [checkingOut, setCheckingOut] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [lastSale, setLastSale] = React.useState<Sale | null>(null);

  const cartSubtotal = cart.reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0
  );
  const taxCents = Math.round(cartSubtotal * 0.08);
  const totalCents = cartSubtotal + taxCents;

  const refreshProducts = React.useCallback(async () => {
    if (!token) {
      return;
    }

    setLoadingProducts(true);
    try {
      const data = await apiRequest<{ products: Product[] }>("/products", {
        token
      });
      setProducts(data.products);
      setCart((currentCart) =>
        currentCart
          .map((line) => {
            const freshProduct = data.products.find(
              (product) => product.id === line.product.id
            );
            if (!freshProduct) {
              return null;
            }
            return {
              product: freshProduct,
              quantity: Math.min(line.quantity, freshProduct.stock)
            };
          })
          .filter((line): line is CartLine => Boolean(line && line.quantity > 0))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load products");
    } finally {
      setLoadingProducts(false);
    }
  }, [token]);

  React.useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  React.useEffect(() => {
    if (!token) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshProducts();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [refreshProducts, token]);

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((line) => line.product.id === product.id);

      if (!existing) {
        return [...currentCart, { product, quantity: 1 }];
      }

      return currentCart.map((line) =>
        line.product.id === product.id
          ? {
              ...line,
              quantity: Math.min(line.quantity + 1, product.stock)
            }
          : line
      );
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    setCart((currentCart) =>
      currentCart
        .map((line) =>
          line.product.id === productId
            ? {
                ...line,
                quantity: Math.max(0, Math.min(quantity, line.product.stock))
              }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  async function checkout() {
    if (cart.length === 0) {
      return;
    }

    setCheckingOut(true);
    setMessage("");

    try {
      const data = await apiRequest<{ sale: Sale }>("/sales", {
        method: "POST",
        token,
        body: JSON.stringify({
          taxCents,
          items: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity
          }))
        })
      });

      setLastSale(data.sale);
      setCart([]);
      setMessage("Checkout complete. Inventory has been updated.");
      await refreshProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed");
      await refreshProducts();
    } finally {
      setCheckingOut(false);
    }
  }

  function handleAuth(nextToken: string, nextUser: User) {
    localStorage.setItem("pos_token", nextToken);
    localStorage.setItem("pos_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setMessage("");
  }

  function logout() {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    setToken("");
    setUser(null);
    setProducts([]);
    setCart([]);
  }

  if (!token || !user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tenant POS</p>
          <h1>{user.tenant?.name ?? "Store"} Register</h1>
        </div>
        <div className="topbar-actions">
          <div className="cashier">
            <span>{user.name}</span>
            <small>{user.role}</small>
          </div>
          <button className="icon-button" onClick={refreshProducts} title="Refresh stock">
            {loadingProducts ? <Loader2 className="spin" /> : <RefreshCw />}
          </button>
          <button className="secondary-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <section className="metrics">
        <Metric icon={<Boxes />} label="Products" value={products.length.toString()} />
        <Metric
          icon={<ShoppingCart />}
          label="Cart items"
          value={cart.reduce((sum, line) => sum + line.quantity, 0).toString()}
        />
        <Metric icon={<BadgeDollarSign />} label="Cart total" value={formatMoney(totalCents)} />
      </section>

      {message ? <div className="status-line">{message}</div> : null}

      <div className="workspace">
        <section className="product-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Product List</h2>
            </div>
            <span>{loadingProducts ? "Updating stock" : "Live stock"}</span>
          </div>

          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div>
                  <div className="product-title-row">
                    <h3>{product.name}</h3>
                    <span className={product.stock <= 5 ? "stock low" : "stock"}>
                      {product.stock} left
                    </span>
                  </div>
                  <p>{product.sku}</p>
                </div>
                <div className="product-footer">
                  <strong>{formatMoney(product.priceCents)}</strong>
                  <button
                    className="primary-button"
                    disabled={!product.active || product.stock <= 0}
                    onClick={() => addToCart(product)}
                  >
                    <Plus />
                    Add
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!loadingProducts && products.length === 0 ? (
            <div className="empty-state">No products yet. Add products through the API first.</div>
          ) : null}
        </section>

        <aside className="checkout-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current Sale</p>
              <h2>Cart</h2>
            </div>
            <ShoppingCart />
          </div>

          <div className="cart-list">
            {cart.map((line) => (
              <div className="cart-line" key={line.product.id}>
                <div>
                  <strong>{line.product.name}</strong>
                  <span>{formatMoney(line.product.priceCents)} each</span>
                </div>
                <div className="quantity-control">
                  <button
                    className="icon-button small"
                    onClick={() => changeQuantity(line.product.id, line.quantity - 1)}
                  >
                    <Minus />
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    className="icon-button small"
                    onClick={() => changeQuantity(line.product.id, line.quantity + 1)}
                    disabled={line.quantity >= line.product.stock}
                  >
                    <Plus />
                  </button>
                  <button
                    className="icon-button small danger"
                    onClick={() => changeQuantity(line.product.id, 0)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {cart.length === 0 ? (
            <div className="empty-state compact">Cart is empty.</div>
          ) : null}

          <div className="totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(cartSubtotal)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{formatMoney(taxCents)}</strong>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{formatMoney(totalCents)}</strong>
            </div>
          </div>

          <button
            className="checkout-button"
            disabled={cart.length === 0 || checkingOut}
            onClick={checkout}
          >
            {checkingOut ? <Loader2 className="spin" /> : <CheckCircle2 />}
            Checkout
          </button>

          {lastSale ? (
            <div className="receipt">
              <span>Last transaction</span>
              <strong>{formatMoney(lastSale.totalCents)}</strong>
              <small>{new Date(lastSale.createdAt).toLocaleString()}</small>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuthScreen({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [tenantName, setTenantName] = React.useState("Main Street Store");
  const [tenantSlug, setTenantSlug] = React.useState("main-street");
  const [name, setName] = React.useState("Store Owner");
  const [email, setEmail] = React.useState("owner@example.com");
  const [password, setPassword] = React.useState("password123");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload =
        mode === "register"
          ? { tenantName, tenantSlug, name, email, password }
          : { tenantSlug, email, password };
      const data = await apiRequest<{ token: string; user: User }>(
        mode === "register" ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      onAuth(data.token, data.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">SaaS POS</p>
        <h1>Store checkout, inventory, and transactions in one register.</h1>
        <p>
          Sign in with a tenant account, add products to the cart, and checkout through
          the Express API.
        </p>
      </section>

      <form className="auth-form" onSubmit={submit}>
        <div className="form-header">
          <Lock />
          <div>
            <h2>{mode === "register" ? "Create tenant" : "Sign in"}</h2>
            <p>{apiBaseUrl}</p>
          </div>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {mode === "register" ? (
          <>
            <label>
              Tenant name
              <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
            </label>
            <label>
              Owner name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          </>
        ) : null}

        <label>
          Tenant slug
          <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="checkout-button" disabled={submitting}>
          {submitting ? <Loader2 className="spin" /> : <Lock />}
          {mode === "register" ? "Create account" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
