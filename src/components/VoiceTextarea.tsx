import { useRef, type ChangeEvent, type TextareaHTMLAttributes } from 'react';
import { useLang } from '../i18n';
import { useOptionalConnectivity } from '../sync/connectivity';
import { getSpeechRecognition, useVoiceDictation } from '../voice/useVoiceDictation';
import { Icon } from './Icon';

/** Drop-in <textarea> with a mic button: speak a note and it is appended to what is already written. */
export function VoiceTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t, lang } = useLang();
  const connectivity = useOptionalConnectivity();
  const online = connectivity ? connectivity.online : typeof navigator === 'undefined' || navigator.onLine;
  const base = useRef('');
  const current = useRef(String(props.value ?? ''));
  current.current = String(props.value ?? '');
  const emit = (value: string) => props.onChange?.({ target: { value }, currentTarget: { value } } as ChangeEvent<HTMLTextAreaElement>);
  const { isListening, toggle } = useVoiceDictation({
    lang, online, disableSampleFallback: true,
    onTranscript: spoken => emit([base.current, spoken].filter(Boolean).join(' ')),
  });
  const supported = !!getSpeechRecognition();
  const label = !online ? t('Voice notes need an internet connection') : isListening ? t('Stop dictation') : t('Speak your notes');
  return <div className="relative">
    <textarea {...props} className={`${className} ${supported ? '!pr-11' : ''}`} />
    {supported && (
      <button type="button" onClick={() => { if (!isListening) base.current = current.current.trim(); toggle(); }} disabled={!online || props.disabled}
        aria-label={label} aria-pressed={isListening} title={label}
        className={`absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border text-xs transition-colors disabled:opacity-40 ${isListening ? 'border-danger bg-danger text-white animate-pulse' : 'border-line bg-white text-teal-700 hover:bg-teal-50'}`}>
        <Icon name="mic" size={15} />
      </button>
    )}
  </div>;
}
