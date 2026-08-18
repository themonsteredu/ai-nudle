import Image from "next/image";
import type { ProcessTone } from "@/lib/ramen-process";

const PROCESS_PHOTOS: Record<ProcessTone, { src: string; alt: string }> = {
  mix: { src: "/process/mix.webp", alt: "라면 원료를 계량해 산업용 혼합기에 넣는 공정" },
  dough: { src: "/process/dough.webp", alt: "산업용 반죽기에서 라면 반죽을 만드는 공정" },
  noodle: { src: "/process/noodle.webp", alt: "반죽을 롤러로 펴고 면발로 자르는 제면 공정" },
  steam: { src: "/process/steam.webp", alt: "라면 면발을 수증기로 익히는 증숙 공정" },
  dry: { src: "/process/dry.webp", alt: "라면 면을 건조하거나 유탕하는 공정" },
  cool: { src: "/process/cool.webp", alt: "생산된 라면 면을 냉각팬으로 식히는 공정" },
  soup: { src: "/process/soup.webp", alt: "라면 스프와 건더기 원료를 계량하는 공정" },
  pack: { src: "/process/pack.webp", alt: "면과 스프팩을 라면 용기에 넣는 포장 공정" },
  check: { src: "/process/check.webp", alt: "포장된 라면을 검사 장비로 확인하는 품질검사 공정" },
};

export function FactoryMotionScene({ tone, playing = true }: { tone: ProcessTone; playing?: boolean }) {
  const photo = PROCESS_PHOTOS[tone];

  return (
    <figure className={`factory-motion-scene tone-${tone} ${playing ? "is-playing" : "is-paused"}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 860px) 100vw, 65vw" priority={tone === "noodle"} />
      <span className="factory-photo-shade" aria-hidden="true" />
      <span className="factory-photo-motion" aria-hidden="true" />
    </figure>
  );
}
