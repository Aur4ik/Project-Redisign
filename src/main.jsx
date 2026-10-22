import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CatalogProvider } from "./context/CatalogContext";
import { Layout, Loading, ErrorBox } from "./components/UI";
import CatalogPage from "./pages/CatalogPage";
import AuthPage from "./pages/AuthPage";
import CarPage from "./pages/CarPage";
import BookingsPage from "./pages/BookingsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import "./style.css";
function Protected({ admin = false, children }) {
  const { user, loading, error, refresh } = useAuth(),
    location = useLocation();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="empty">
        <ErrorBox message={error} />
        <button className="primary" onClick={refresh}>
          Повторить ↻
        </button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin")
    return (
      <div className="empty">
        <h1>Доступ ограничен</h1>
        <p>Этот раздел предназначен для администратора.</p>
        <Link to="/" className="primary">
          К каталогу
        </Link>
      </div>
    );
  return children;
}
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty">
        <h1>Не удалось открыть страницу</h1>
        <p>Попробуйте перезагрузить приложение.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CatalogProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<CatalogPage key="catalog" />} />
                <Route path="/login" element={<AuthPage key="login" />} />
                <Route
                  path="/register"
                  element={<AuthPage register key="register" />}
                />
                <Route path="/cars/:id" element={<CarPage />} />
                <Route
                  path="/cars/:id/test-drive"
                  element={
                    <Protected>
                      <CarPage booking />
                    </Protected>
                  }
                />
                <Route
                  path="/favorites"
                  element={
                    <Protected>
                      <CatalogPage onlyFavorites key="favorites" />
                    </Protected>
                  }
                />
                <Route
                  path="/bookings"
                  element={
                    <Protected>
                      <BookingsPage />
                    </Protected>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Protected>
                      <ProfilePage />
                    </Protected>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <Protected admin>
                      <AdminPage />
                    </Protected>
                  }
                />
                <Route
                  path="*"
                  element={
                    <section className="empty">
                      <h1>404</h1>
                      <p>Кажется, вы свернули с маршрута.</p>
                      <Link className="primary" to="/">
                        Вернуться к автомобилям ↗
                      </Link>
                    </section>
                  }
                />
              </Routes>
            </Layout>
          </CatalogProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")).render(<App />);
