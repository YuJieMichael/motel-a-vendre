(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MAVGuide=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const content={
  "fr": {
    "title": "Documents et vérifications",
    "intro": "Les points à préciser avant de demander des documents ou une visite.",
    "cta": "Demander des renseignements",
    "label": "Guide d’achat",
    "steps": [
      [
        "Ce qui est compris dans la vente",
        "Demandez si le prix concerne l’immeuble, le terrain, l’exploitation ou un autre périmètre. Faites préciser les éléments inclus et exclus."
      ],
      [
        "Chambres et exploitation",
        "Confirmez le nombre exact de chambres, les espaces accessibles, le stationnement et la période d’exploitation."
      ],
      [
        "Documents disponibles",
        "Demandez les périodes couvertes par les revenus, dépenses et données d’occupation, ainsi que les conditions de partage."
      ],
      [
        "Photos et visite",
        "Demandez les photos réelles disponibles et les points à voir sur place. L’équipe doit confirmer la disponibilité et l’horaire."
      ]
    ],
    "faq": [
      [
        "Les prix sont-ils en dollars canadiens ?",
        "Oui. Les montants affichés sont des prix demandés en CAD, à confirmer avec l’équipe."
      ],
      [
        "Toutes les photos montrent-elles la propriété ?",
        "Les images illustratives sont signalées. Une fiche peut ne pas encore disposer de photos réelles publiables."
      ],
      [
        "Les revenus et taux d’occupation sont-ils publics ?",
        "Ils ne sont pas publiés sur ce site. L’équipe confirme les documents disponibles et les conditions de partage."
      ],
      [
        "Comment demander une visite ?",
        "Ouvrez la fiche, choisissez une demande de visite et envoyez vos coordonnées. L’équipe doit confirmer la disponibilité et l’horaire."
      ]
    ]
  },
  "en": {
    "title": "Documents and checks",
    "intro": "Details to clarify before requesting documents or a viewing.",
    "cta": "Request information",
    "label": "Buying guide",
    "steps": [
      [
        "What the sale includes",
        "Ask whether the price covers the building, land, business or another scope. Confirm what is included and excluded."
      ],
      [
        "Rooms and operations",
        "Confirm the exact room count, accessible areas, parking and operating season."
      ],
      [
        "Available documents",
        "Ask which periods the revenue, expense and occupancy records cover, and what conditions apply to sharing them."
      ],
      [
        "Photos and viewing",
        "Ask for available actual property photos and identify what you want to inspect. The team must confirm availability and timing."
      ]
    ],
    "faq": [
      [
        "Are prices in Canadian dollars?",
        "Yes. Displayed amounts are asking prices in CAD and should be confirmed with the team."
      ],
      [
        "Does every photo show the actual property?",
        "Illustrative images are labelled. A property may not yet have real photos available for publication."
      ],
      [
        "Are revenue and occupancy figures public?",
        "They are not published on this site. The team confirms which documents are available and the conditions for sharing."
      ],
      [
        "How do I request a viewing?",
        "Open a property, choose a viewing request and send your contact details. Availability and timing must be confirmed by the team."
      ]
    ]
  },
  "zh": {
    "title": "资料与核验清单",
    "intro": "申请文件或参观之前，先把这些具体问题确认清楚。",
    "cta": "咨询物业资料",
    "label": "收购指南",
    "steps": [
      [
        "出售范围",
        "确认挂牌价对应建筑、土地、经营业务还是其他范围，并询问包含和不包含哪些项目。"
      ],
      [
        "客房与经营情况",
        "核实准确客房数、可使用空间、停车设施和营业季节。"
      ],
      [
        "可提供的文件",
        "询问收入、支出和入住记录覆盖的时间范围，以及文件分享条件。"
      ],
      [
        "照片与参观",
        "申请可提供的实景照片，列出希望现场查看的项目。参观时间和在售状态仍需团队确认。"
      ]
    ],
    "faq": [
      [
        "挂牌价格是否为加元？",
        "是。页面显示的是加元挂牌报价，具体金额请向团队确认。"
      ],
      [
        "所有照片都是物业实景吗？",
        "示意图片会明确标注。部分房源暂时没有可公开使用的实景照片。"
      ],
      [
        "网站公开营业收入和入住率吗？",
        "本站不公开这些经营数字。团队会确认有哪些文件可提供，以及分享条件。"
      ],
      [
        "如何申请参观？",
        "打开房源详情，选择申请参观并发送联系方式。具体可用时间仍需团队确认。"
      ]
    ]
  }
};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(lang,copy={}){const c=content[lang];return `<section class="buying-guide wrap" aria-labelledby="guide-heading"><p class="eyebrow muted">MOTEL À VENDRE / ${esc(c.label)}</p><h1 id="guide-heading">${esc(c.title)}</h1><p class="guide-lead">${esc(c.intro)}</p><div class="guide-steps">${c.steps.map(([title,text],i)=>`<article><span class="eyebrow muted">0${i+1}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></article>`).join('')}</div><button class="button button-dark buyer-trigger">${esc(c.cta)} ↗︎</button><section class="guide-seller" id="vendre" aria-labelledby="guide-seller-heading"><h2 id="guide-seller-heading">${esc(copy.prepareTitle)}</h2><ul>${[1,2,3,4].map(n=>`<li>${esc(copy['prepare'+n])}</li>`).join('')}</ul><p>${esc(copy.ownerPrivacy)}</p><button class="button button-outline seller-trigger">${esc(copy.sellerCta)}</button></section><section class="guide-faq" id="faq"><h2>FAQ</h2>${c.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section></section>`;}
 return {content,render};
});
