"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "./Button";
import { Barber } from "@/types";

interface BarberCardProps {
  barber: Barber;
}

export default function BarberCard({ barber }: BarberCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative overflow-hidden aspect-square w-full shadow-sm">
        <Image
          src={barber.image}
          alt={barber.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-4 w-full">
        <h3 className="text-base font-normal tracking-[0.15em] uppercase text-black">
          {barber.name}
        </h3>
        <Button href={barber.bookingUrl} external variant="outline" className="w-full text-center py-3">
          BOOK APPOINTMENT
        </Button>
      </div>
    </div>
  );
}