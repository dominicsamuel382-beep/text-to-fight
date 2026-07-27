import { createFileRoute } from "@tanstack/react-router";
import { FightGame } from "@/components/FightGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KEYSTRIKE // Neon Typing Fighter" },
      { name: "description", content: "A cyberpunk 1v1 typing fighting game. Type fast, land combos, unleash ultimates." },
      { property: "og:title", content: "KEYSTRIKE // Neon Typing Fighter" },
      { property: "og:description", content: "A cyberpunk 1v1 typing fighting game. Type fast, land combos, unleash ultimates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <FightGame />;
}
