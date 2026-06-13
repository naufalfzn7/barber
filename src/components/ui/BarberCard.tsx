import Image from "next/image";
import Button from "./Button";
import { Barber } from "@/types";

interface BarberCardProps {
  barber: Barber;
}

export default function BarberCard({ barber }: BarberCardProps) {
  const initials = barber.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden aspect-square w-full shadow-sm">
        {barber.image ? (
          <Image
            src={barber.image}
            alt={barber.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#2A2A2A]">
            <span className="text-3xl md:text-4xl font-light tracking-[0.15em] text-white/80 uppercase">
              {initials || "M"}
            </span>
          </div>
        )}
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
