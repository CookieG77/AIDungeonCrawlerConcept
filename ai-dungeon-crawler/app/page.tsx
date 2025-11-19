import Image from "next/image";

export default function Home() {
  return (
    <div>
      <h1>Welcome to AI Dungeon Crawler</h1>
      <p>Embark on an epic adventure powered by AI!</p>

      <a href="/game" className="start-button">
        Start Your Adventure
      </a>
    </div>
  );
}
