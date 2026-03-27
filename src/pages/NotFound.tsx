import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const EMPTY_STATE_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/07em6SVOcMqgNFap9Lry4G/sandbox/8b42eylK868jWkOlBdaV92-img-1_1770450406000_na1fn_dmF1bHQtZW1wdHktc3RhdGU.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMDdlbTZTVk9jTXFnTkZhcDlMcnk0Ry9zYW5kYm94LzhiNDJleWxLODY4aldrT2xCZGFWOTItaW1nLTFfMTc3MDQ1MDQwNjAwMF9uYTFmbl9kbUYxYkhRdFpXMXdkSGt0YzNSaGRHVS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=G6WMwY1ohup9wYpk6V~d82lj-7dtXscr0BFpo0K2BkAAa0tgr0B1e3RcNwLh3nAmVuDDrKst4G2YtcjprAk84DbR8FiH3u3Wt06vvNTZLwgi7ORtXNwbskwFSsGs~xVpPrWpp3daZuK~Mt3srdqfK9tn3IxQ3E7jW32tM46UgfS-3mtEKzp1FBUkGzEKTC7~4TDMABAjXZtQcGQ5TjXMqjLo~UJuvz-Aqlmrm~g2BEAjhfUhN0tIEDe05N~5cZASty-EJQegszoIXPdrHZ2oEBQDRAWzBYyzJZdOcj14yTntVgvaVvMGZzoYCaI8ZyY65wa79BiuSIG6iMB6uW2alQ__";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-full max-w-md mb-8 rounded-xl overflow-hidden shadow-lg">
        <img src={EMPTY_STATE_IMG} alt="Empty vault shelf" className="w-full h-48 object-cover" />
      </div>
      <h1 className="text-5xl font-bold text-foreground mb-2 font-display">404</h1>
      <h2 className="text-lg font-medium text-muted-foreground mb-1">This vault shelf is empty</h2>
      <p className="text-sm text-muted-foreground/70 mb-8 max-w-sm">
        The page you're looking for doesn't exist in the Maison Em system. It may have been moved or removed.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
        <Button onClick={() => setLocation('/dashboard')} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
          <Home className="w-4 h-4" /> Dashboard
        </Button>
      </div>
    </div>
  );
}
