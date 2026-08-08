// The caregiver's referral link.
// ------------------------------------------------------------------
// Self-contained on purpose: it reads the signed-in Firebase user itself
// rather than taking props, so it can be dropped anywhere inside the hub
// without threading a code through SettingsTab's prop list. It renders
// nothing at all when there is no cloud account behind it — a local demo
// session or an unlinked patient device has no referral record, and an empty
// card with a dead link would be worse than no card.

import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { ensureReferralRecord } from '../lib/referral';
import { referralLink } from '../lib/referralCode';

const ReferralCard: React.FC = () => {
  const [record, setRecord] = useState<{ code: string; signups: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid) return;

    let alive = true;
    // Idempotent — the sign-in hook has almost certainly created this already,
    // but a caregiver who reaches Settings first still gets a code rather than
    // an empty card.
    ensureReferralRecord(uid).then((r) => {
      if (alive && r) setRecord({ code: r.code, signups: r.signups });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!record) return null;

  const link = referralLink(record.code, typeof window !== 'undefined' ? window.location.href : null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access is refused on insecure origins and in some in-app
      // browsers. Selecting the text leaves them one keystroke from the same
      // result, which is the whole point of keeping the link in a real input.
      const input = document.getElementById('referral-link-input') as HTMLInputElement | null;
      input?.select();
    }
  };

  return (
    <div className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A] flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-[#5C8D71]" />
            Share Yadira
          </span>
          <span className="text-[10px] text-[#7E7D76] leading-tight mt-0.5">
            Your link, for someone else in the middle of this.
          </span>
        </div>
        {record.signups > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 bg-[#3A5D45] text-white">
            {record.signups} joined
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          id="referral-link-input"
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your referral link"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-mono bg-white border border-[#E3DFC2] text-[#5E5D57] focus:outline-none focus:border-[#5C8D71]"
        />
        <button
          type="button"
          onClick={copy}
          title="Copy your referral link"
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-[#3A5D45] text-white hover:bg-[#2B4633] shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="text-[10px] text-[#7E7D76] leading-snug mt-2">
        Anyone who opens this link and makes an account is counted as yours. The companion is
        free for their family too — nothing about this link costs them anything.
      </p>
    </div>
  );
};

export default ReferralCard;
