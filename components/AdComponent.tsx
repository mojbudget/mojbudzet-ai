
import React, { useEffect } from 'react';

interface AdComponentProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
}

const AdComponent: React.FC<AdComponentProps> = ({ slot, format = 'auto' }) => {
  const CLIENT_ID = "ca-pub-XXXXXXXXXXXXXXXX"; // ЗАМЕНИ ГО ОВА СО ТВОЈОТ REAL ID

  useEffect(() => {
    // Не иницијализирај ако е placeholder
    if (CLIENT_ID.includes('XXXX')) return;

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense logic skipped or failed:", e);
    }
  }, []);

  // Ако ID-то е сè уште со XXXXX, прикажи само стилизиран простор
  if (CLIENT_ID.includes('XXXX')) {
    return (
      <div className="ad-container opacity-50">
        {/* Placeholder-от е веќе дефиниран во CSS во index.html */}
      </div>
    );
  }

  return (
    <div className="ad-container">
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client={CLIENT_ID}
           data-ad-slot={slot}
           data-ad-format={format}
           data-full-width-responsive="true"></ins>
    </div>
  );
};

export default AdComponent;
