import { Metadata } from 'next';
import AboutPageClient from './AboutPageClient';

export const metadata: Metadata = {
  title: 'About - FlyX | Rethinking Digital Access',
  description: 'Exploring the philosophy of digital ownership, access, and the future of media consumption in the modern era.',
  keywords: 'digital rights, media access, streaming philosophy, content ownership',
};

export default function AboutPage() {
  return <AboutPageClient />;
}