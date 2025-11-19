import Image from "next/image";

export default function Home() {
  return (
    <div>
      <h1>Welcome to AI Dungeon Crawler</h1>
      <p>Embark on an epic adventure powered by AI!</p>

      <a href="/game" className="start-button">
        <p>Start Your Adventure,</p>
        <p>Miaou! (don't forget this is a cat game please)</p>
      </a>

      <a href="/promptpage" className="start-button">
        <p>Test your adventure? what ok do whatever i guess.</p>
      </a>
    </div>
  );
}
