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
          alt="Printava"
          className={cn('h-16 w-auto object-contain sm:h-20', logoClassName)}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:h-20 sm:w-20">
            <Printer className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">Printava</span>
        </>
      )}
    </div>
  );
}
