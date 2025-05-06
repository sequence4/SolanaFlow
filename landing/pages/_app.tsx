import '../src/styles/globals.css';
import type { AppProps } from 'next/app';
import LandingStyles from '../src/components/landing/style';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <LandingStyles />
      <Component {...pageProps} />
    </>
  );
}
