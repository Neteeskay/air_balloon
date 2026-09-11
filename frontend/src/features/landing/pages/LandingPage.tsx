import { ScrollContainer } from '../components/ScrollContainer';
import { CloudIntro } from '../sections/CloudIntro';
import { Hero } from '../sections/Hero';
import { Final } from '../sections/Final';
import '../styles/landing.css';

export function LandingPage() {
  return (
    <ScrollContainer>
      <CloudIntro />
      <Hero />
      <Final />
    </ScrollContainer>
  );
}
