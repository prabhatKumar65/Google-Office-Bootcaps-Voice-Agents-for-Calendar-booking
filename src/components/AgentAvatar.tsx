import React, { useState } from 'react';
import { Bot } from 'lucide-react';

export const DEFAULT_AGENT_PORTRAIT = '/assets/aistudio/agent_35db2fba.jpg';

interface AgentAvatarProps {
  customSrc?: string | null;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  speaking?: boolean;
  alt?: string;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  customSrc,
  size = 'md',
  active = false,
  speaking = false,
  alt = 'Prabhat Personal AI Agent portrait',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const src = !imgFailed ? customSrc || DEFAULT_AGENT_PORTRAIT : null;

  const sizeClass =
    size === 'sm'
      ? 'h-9 w-9 rounded-full'
      : size === 'lg'
        ? 'h-20 w-20 rounded-full'
        : 'h-12 w-12 rounded-full';

  const ringClass = speaking
    ? 'ring-2 ring-blue-700 ring-offset-2'
    : active
      ? 'ring-1 ring-slate-300'
      : '';

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-slate-200 bg-white transition-shadow duration-200 ${sizeClass} ${ringClass}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
          <Bot className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
};
