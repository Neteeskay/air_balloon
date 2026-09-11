import { ScrollContainer } from '../components/ScrollContainer';
import { Hero } from '../sections/Hero';
import { Final } from '../sections/Final';
import '../styles/landing.css';

export function LandingPage() {
  return (
    <ScrollContainer>
      <Hero />
      <Final />
    </ScrollContainer>
  );
}
