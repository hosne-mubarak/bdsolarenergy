import { ResetDemoData } from '../../features/settings/ResetDemoData';
import { Button } from '../common/primitives';
import { Link } from 'react-router';
import { Sun, Mail, MapPin, Phone, ArrowUpRight } from 'lucide-react';
import { useNavigation, useSiteSettings } from '../../features/store/useStore';

export function StoreFooter() {
  const settings = useSiteSettings();
  const navigation = useNavigation();
  return (
    <footer className="store-footer">
      <div className="container footer-grid">
        <section>
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Sun size={26} aria-hidden="true" />
            </span>
            <span className="brand-wordmark">{settings.data?.name ?? 'Storefront'}</span>
          </Link>
          {settings.data && <p className="footer-demo-note">{settings.data.demoNotice}</p>}
        </section>
        <nav aria-label="Footer shopping links">
          <h2>Explore</h2>
          {(navigation.data ?? [])
            .filter((item) => !item.parentId)
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <Link key={item.id} to={item.path}>
                {item.label}
                <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            ))}
        </nav>
        <nav aria-label="Policies and help">
          <h2>Here to help</h2>
          <Link to="/faq">Frequently asked questions</Link>
          <Link to="/shipping-delivery">Shipping &amp; delivery</Link>
          <Link to="/returns-refunds">Returns &amp; refunds</Link>
          <Link to="/warranty">Warranty policy</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms &amp; conditions</Link>
        </nav>
        <section>
          <h2>Get in touch</h2>
          {settings.isError ? (
            <div>
              <p role="alert">Store information is unavailable.</p>
              <Button
                variant="secondary"
                disabled={settings.isFetching}
                onClick={() => void settings.refetch()}
              >
                Retry store information
              </Button>
            </div>
          ) : settings.data ? (
            <address className="footer-contact">
              <a href={`tel:${settings.data.contact.phone}`}>
                <Phone size={16} aria-hidden="true" />
                {settings.data.contact.phone}
              </a>
              <a href={`mailto:${settings.data.contact.email}`}>
                <Mail size={16} aria-hidden="true" />
                {settings.data.contact.email}
              </a>
              <p>
                <MapPin size={16} aria-hidden="true" />
                {settings.data.contact.address}
              </p>
            </address>
          ) : (
            <p role="status">Store information is loading.</p>
          )}
        </section>
      </div>
      <div className="container footer-bottom">
        <p>
          ©{' '}
          {new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Dhaka' }).format(
            new Date(),
          )}{' '}
          {settings.data?.name ?? 'Storefront'}
        </p>
        <p>Local demonstration · No real payments</p>
        <ResetDemoData />
      </div>
    </footer>
  );
}
