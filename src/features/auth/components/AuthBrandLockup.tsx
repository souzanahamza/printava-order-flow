import { useState } from 'react';
import { Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

import brandLogo from '@/assets/logo.png';

type AuthBrandLockupProps = {
  className?: string;
  logoClassName?: string;
};

export function AuthBrandLockup({ className, logoClassName }: AuthBrandLockupProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={cn('flex w-full items-center justify-center gap-3', className)}>
      {!imgFailed ? (
        <img
          src={brandLogo}
          alt="Print Flow OMS"
          className={cn('h-20 w-auto object-contain sm:h-24', logoClassName)}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:h-24 sm:w-24">
            <Printer className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden />
          </div>
          <span className="font-bold text-3xl tracking-tight text-foreground sm:text-4xl">Printava</span>
        </>
      )}
    </div>
  );
}
