(() => {
  const ICON = `__COMI_CHEST_ICON__`;
  const CSS = `__COMI_INVENTORY_CSS__`;
  const key = 'comi.shopping-list.v1';
  const dialogId = 'comi-shopping-dialog';
  const langs = {
    id:{title:'Daftar belanja',search:'Cari barang atau booth…',results:'Katalog Comifuro',cart:'Barang ditambahkan',add:'Tambah',remove:'Hapus',minus:'Kurangi',plus:'Tambah',more:'Muat lainnya',loading:'Memuat katalog…',error:'Katalog tidak dapat dimuat.',empty:'Tidak ada barang ditemukan.',cartEmpty:'Belum ada barang di daftar.',total:'Total harga',unknown:'Harga belum tersedia',review:'Perlu diperiksa',booth:'Booth',boothCatalog:'Barang di booth ini',imageUnavailable:'Gambar tidak tersedia',map:'Daftar belanja',close:'Tutup'},
    en:{title:'Shopping list',search:'Search items or booths…',results:'Comifuro catalog',cart:'Added items',add:'Add',remove:'Remove',minus:'Decrease',plus:'Increase',more:'Load more',loading:'Loading catalog…',error:'Could not load catalog.',empty:'No items found.',cartEmpty:'Your list is empty.',total:'Total price',unknown:'Price unavailable',review:'Needs review',booth:'Booth',boothCatalog:'Items at this booth',imageUnavailable:'Image unavailable',map:'Shopping list',close:'Close'},
    zh:{title:'购物清单',search:'搜索商品或摊位…',results:'Comifuro 商品目录',cart:'已添加商品',add:'添加',remove:'删除',minus:'减少',plus:'增加',more:'加载更多',loading:'正在加载目录…',error:'无法加载目录。',empty:'没有找到商品。',cartEmpty:'清单还是空的。',total:'商品总价',unknown:'暂无价格',review:'待核实',booth:'摊位',boothCatalog:'本摊位商品',imageUnavailable:'图片不可用',map:'购物清单',close:'关闭'},
    ja:{title:'買い物リスト',search:'商品・サークルを検索…',results:'Comifuro カタログ',cart:'追加した商品',add:'追加',remove:'削除',minus:'数量を減らす',plus:'数量を増やす',more:'もっと見る',loading:'カタログを読み込み中…',error:'カタログを読み込めません。',empty:'商品が見つかりません。',cartEmpty:'リストは空です。',total:'合計金額',unknown:'価格不明',review:'要確認',booth:'サークル',boothCatalog:'このサークルの商品',imageUnavailable:'画像を表示できません',map:'買い物リスト',close:'閉じる'},
    ko:{title:'쇼핑 목록',search:'상품 또는 부스 검색…',results:'Comifuro 카탈로그',cart:'담은 상품',add:'담기',remove:'삭제',minus:'감소',plus:'증가',more:'더 보기',loading:'카탈로그 불러오는 중…',error:'카탈로그를 불러오지 못했습니다.',empty:'상품을 찾을 수 없습니다.',cartEmpty:'목록이 비어 있습니다.',total:'총 가격',unknown:'가격 정보 없음',review:'확인 필요',booth:'부스',boothCatalog:'이 부스의 상품',imageUnavailable:'이미지를 표시할 수 없습니다',map:'쇼핑 목록',close:'닫기'},
    th:{title:'รายการช้อปปิ้ง',search:'ค้นหาสินค้าหรือบูธ…',results:'แคตตาล็อก Comifuro',cart:'สินค้าที่เพิ่มแล้ว',add:'เพิ่ม',remove:'ลบ',minus:'ลด',plus:'เพิ่ม',more:'โหลดเพิ่ม',loading:'กำลังโหลดแคตตาล็อก…',error:'โหลดแคตตาล็อกไม่ได้',empty:'ไม่พบสินค้า',cartEmpty:'ยังไม่มีสินค้าในรายการ',total:'ราคารวม',unknown:'ไม่มีข้อมูลราคา',review:'รอตรวจสอบ',booth:'บูธ',boothCatalog:'สินค้าของบูธนี้',imageUnavailable:'ไม่มีรูปภาพ',map:'รายการช้อปปิ้ง',close:'ปิด'},
    vi:{title:'Danh sách mua sắm',search:'Tìm sản phẩm hoặc gian hàng…',results:'Danh mục Comifuro',cart:'Mặt hàng đã thêm',add:'Thêm',remove:'Xóa',minus:'Giảm',plus:'Tăng',more:'Xem thêm',loading:'Đang tải danh mục…',error:'Không tải được danh mục.',empty:'Không tìm thấy mặt hàng.',cartEmpty:'Danh sách đang trống.',total:'Tổng giá',unknown:'Chưa có giá',review:'Cần kiểm tra',booth:'Gian hàng',boothCatalog:'Mặt hàng tại gian hàng này',imageUnavailable:'Không có ảnh',map:'Danh sách mua sắm',close:'Đóng'}
  };
  const lang = () => {
    const value = (document.documentElement.lang || 'id').toLowerCase();
    return value.startsWith('zh') ? 'zh' : (['id','en','ja','ko','th','vi'].find((x) => value.startsWith(x)) || 'id');
  };
  const t = (word) => langs[lang()][word] || langs.en[word] || word;
  let cart = (() => { try { const data=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(data)?data:[]; } catch { return []; } })();
  let query='', offset=0, hasMore=false, loading=false, request=0, timer;
  let selectedBoothSlug='', selectedBoothName='', boothOffset=0, boothMore=false, boothRequest=0, boothLoading=false;
  let boothTitleObserver=null, boothWatchInstalled=false;
  const imageQueue=[], pendingImages=new Map(), memoryImages=new Map();
  const imageMemoryLimit=12*1024*1024;
  let activeImageLoads=0,activeImagePreloads=0,imageSequence=0,imageMemorySize=0;
  let imageViewer=null, viewerImage=null, viewerScale=1, viewerX=0, viewerY=0, viewerPointers=new Map();
  let viewerPinchDistance=0, viewerPinchScale=1, viewerPinchAnchorX=0, viewerPinchAnchorY=0, viewerLastTap=0;
  let viewerGestureMoved=false, viewerPinched=false;
  const node = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; };
  const price = (value, currency='IDR') => {
    if(value==null || !Number.isFinite(Number(value))) return t('unknown');
    try { return new Intl.NumberFormat(document.documentElement.lang||'id',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(Number(value)); }
    catch { return 'Rp '+Number(value).toLocaleString('id-ID'); }
  };
  function parseMoney(text) {
    const match=text.match(/(?:\bRp\.?|\bIDR)\s*([\d][\d.,]*(?:\s*k)?)/i) || text.match(/\b([\d]+(?:[.,][\d]+)?)\s*k\b/i);
    if(!match)return null;
    const token=match[1].replace(/\s/g,'');
    if(/[kK]$/.test(token))return Math.round(Number(token.slice(0,-1).replace(',','.'))*1000);
    const amount=Number(token.replace(/[.,]/g,''));
    return Number.isFinite(amount)?amount:null;
  }
  function parsedPrice(item) {
    const text=String(item.priceText||'');
    const deal=text.match(/\b(?:beli|buy)\s*(\d+)\s*(?:pcs|items?)?\s*[:=–-]\s*(?:Rp\.?|IDR)?\s*([\d][\d.,]*(?:\s*k)?)/i);
    const unitText=deal?text.slice(0,deal.index):text;
    const unit=parseMoney(unitText) ?? (item.priceAmount==null?null:Number(item.priceAmount));
    const bundle=deal?{quantity:Number(deal[1]),price:parseMoney('Rp '+deal[2])}:null;
    return {unit:Number.isFinite(unit)?unit:null,bundle:bundle&&bundle.quantity>0&&Number.isFinite(bundle.price)?bundle:null};
  }
  const persist = () => { try { localStorage.setItem(key,JSON.stringify(cart)); } catch {} };
  function build() {
    if(document.getElementById(dialogId))return;
    const dialog=node('dialog','comi-shopping');
    dialog.id=dialogId;
    dialog.setAttribute('aria-labelledby','comi-shopping-title');
    dialog.innerHTML='<div class="comi-shop-scroll"><header class="comi-shop-header"><h1 id="comi-shopping-title"></h1><button class="comi-shop-close" type="button">×</button></header><label class="comi-shop-search"><span></span><input type="search" autocomplete="off"></label><section><h2 class="comi-shop-heading"></h2><div class="comi-shop-results" aria-live="polite"></div><button class="comi-shop-more" type="button"></button></section><section><h2 class="comi-shop-heading"></h2><div class="comi-shop-cart"></div></section><footer class="comi-shop-total"><span></span><strong></strong></footer></div>';
    document.body.append(dialog);
    dialog.querySelector('.comi-shop-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close();});
    dialog.addEventListener('cancel',(e)=>{e.preventDefault();dialog.close();});
    dialog.querySelector('input').addEventListener('input',(e)=>{query=e.target.value.trim();request++;loading=false;clearTimeout(timer);timer=setTimeout(()=>fetchItems(false),250);});
    dialog.querySelector('.comi-shop-more').addEventListener('click',()=>fetchItems(true));
    labels();
  }
  function labels() {
    const d=document.getElementById(dialogId); if(!d)return;
    d.querySelector('#comi-shopping-title').textContent=t('title');
    const close=d.querySelector('.comi-shop-close'); close.setAttribute('aria-label',t('close'));
    d.querySelector('.comi-shop-search span').textContent=t('search');
    d.querySelector('input').placeholder=t('search');
    const heads=d.querySelectorAll('.comi-shop-heading'); heads[0].textContent=t('results'); heads[1].textContent=t('cart');
    const more=d.querySelector('.comi-shop-more'); more.textContent=t('more'); more.hidden=!hasMore||loading;
    d.querySelector('.comi-shop-total span').textContent=t('total');
    renderCart();
  }
  function add(item) {
    const row=cart.find((x)=>x.item.id===item.id);
    if(row)row.qty++; else cart.push({item,qty:1});
    persist();renderCart();updateBoothQuantities();
  }
  function change(id,delta) {
    const row=cart.find((x)=>x.item.id===id);if(!row)return;
    row.qty+=delta;if(row.qty<1)cart=cart.filter((x)=>x.item.id!==id);
    persist();renderCart();updateBoothQuantities();
  }
  function removeFromCart(id) {
    cart=cart.filter((x)=>x.item.id!==id);persist();renderCart();updateBoothQuantities();
  }
  function updateBoothQuantities() {
    document.querySelectorAll('.comi-booth-product[data-item-id]').forEach((row)=>{
      const itemId=row.dataset.itemId,entry=cart.find((x)=>x.item.id===itemId),qty=entry?.qty||0;
      row.querySelector('.comi-booth-qty-value').textContent=String(qty);
      row.querySelector('.comi-booth-minus').disabled=qty===0;
      row.querySelector('.comi-booth-remove').disabled=qty===0;
    });
  }
  function renderCart() {
    const root=document.querySelector('#'+dialogId+' .comi-shop-cart');if(!root)return;
    root.replaceChildren();let sum=0,priced=0;const bundleGroups=new Map();
    if(!cart.length)root.append(node('p','comi-shop-message',t('cartEmpty')));
    for(const row of cart) {
      const item=row.item||{},parsed=parsedPrice(item);
      if(parsed.unit!=null){
        priced+=row.qty;
        if(parsed.bundle){
          const group=[item.boothId||item.boothName||'',item.currency||'IDR',parsed.unit,parsed.bundle.quantity,parsed.bundle.price].join('|');
          const current=bundleGroups.get(group)||{quantity:0,bundle:parsed.bundle,unit:parsed.unit};
          current.quantity+=row.qty;bundleGroups.set(group,current);
        }else sum+=parsed.unit*row.qty;
      }
      const card=node('article','comi-shop-cart-row'),main=node('div','comi-shop-cart-main');
      main.append(node('strong','comi-shop-item-name',item.name||'—'),node('span','comi-shop-item-booth',item.boothName||t('booth')),node('span','comi-shop-price',item.priceText||price(item.priceAmount,item.currency)));
      const controls=node('div','comi-shop-quantity');
      const minus=node('button','comi-shop-qty-button','−');minus.type='button';minus.setAttribute('aria-label',t('minus'));minus.addEventListener('click',()=>change(item.id,-1));
      controls.append(minus,node('span','comi-shop-qty-value',String(row.qty)));
      const plus=node('button','comi-shop-qty-button','+');plus.type='button';plus.setAttribute('aria-label',t('plus'));plus.addEventListener('click',()=>change(item.id,1));
      const remove=node('button','comi-shop-remove','×');remove.type='button';remove.setAttribute('aria-label',t('remove'));remove.addEventListener('click',()=>removeFromCart(item.id));
      controls.append(plus,remove);card.append(main,controls);root.append(card);
    }
    for(const group of bundleGroups.values())sum+=Math.floor(group.quantity/group.bundle.quantity)*group.bundle.price+(group.quantity%group.bundle.quantity)*group.unit;
    const total=document.querySelector('#'+dialogId+' .comi-shop-total strong');
    if(total)total.textContent=priced?price(sum):t('unknown');
  }
  function renderResults(items,append,message) {
    const root=document.querySelector('#'+dialogId+' .comi-shop-results');if(!root)return;
    if(!append){root.replaceChildren();root.scrollTop=0;}
    if(message){root.append(node('p','comi-shop-message',message));return;}
    if(!items.length&&!append)root.append(node('p','comi-shop-message',t('empty')));
    for(const item of items) {
      const card=node('article','comi-shop-item'),main=node('div','comi-shop-item-main');
      main.append(node('strong','comi-shop-item-name',item.name||'—'),node('span','comi-shop-item-booth',(item.boothName||t('booth'))+' · '+(item.category||'')));
      if(item.reviewStatus==='needs_review')main.append(node('span','comi-shop-review',t('review')));
      const foot=node('div','comi-shop-item-bottom');
      foot.append(node('span','comi-shop-price',item.priceText||price(item.priceAmount,item.currency)));
      if(item.sourceUrl){const a=node('a','comi-shop-source','↗');a.href=item.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Source');foot.append(a);}
      const button=node('button','comi-shop-add',t('add'));button.type='button';button.addEventListener('click',()=>add(item));
      card.append(main,foot,button);root.append(card);
    }
    if(!append)requestAnimationFrame(()=>{if(root.isConnected)root.scrollTop=0;});
  }
  function boothSection() {
    const body=document.querySelector('#bd');if(!body)return null;
    let section=body.querySelector('#comi-booth-catalog');
    if(!section){
      section=node('section','comi-booth-catalog');section.id='comi-booth-catalog';section.hidden=true;
      section.innerHTML='<h3 class="comi-booth-heading"></h3><div class="comi-booth-groups"></div><button class="comi-booth-more" type="button"></button>';
      section.querySelector('.comi-booth-more').addEventListener('click',()=>loadBoothItems(true));
    }
    const article=body.querySelector('article.card'),actions=article?.querySelector('.acts');
    if(actions)actions.after(section);else if(article)article.after(section);else body.append(section);
    return section;
  }
  function renderBoothLabels() {
    const section=document.querySelector('#comi-booth-catalog');if(!section)return;
    section.querySelector('.comi-booth-heading').textContent=t('boothCatalog')+(selectedBoothName?' · '+selectedBoothName:'');
    const more=section.querySelector('.comi-booth-more');more.textContent=t('more');more.hidden=!boothMore||boothLoading;
    section.querySelectorAll('.comi-booth-minus').forEach((button)=>button.setAttribute('aria-label',t('minus')));
    section.querySelectorAll('.comi-booth-plus').forEach((button)=>button.setAttribute('aria-label',t('plus')));
    section.querySelectorAll('.comi-booth-remove').forEach((button)=>button.setAttribute('aria-label',t('remove')));
  }
  function imageKey(url,variant){return url+'|'+variant;}
  function rememberImage(key,data) {
    const size=data.length*2;
    if(size>imageMemoryLimit)return;
    if(memoryImages.has(key)){imageMemorySize-=memoryImages.get(key).size;memoryImages.delete(key);}
    memoryImages.set(key,{data,size});imageMemorySize+=size;
    while(imageMemorySize>imageMemoryLimit){const oldest=memoryImages.keys().next().value;imageMemorySize-=memoryImages.get(oldest).size;memoryImages.delete(oldest);}
  }
  function requestCatalogImage(url,variant,priority=0,preload=false) {
    if(!url||!url.startsWith('https://pbs.twimg.com/media/'))return Promise.resolve(null);
    const key=imageKey(url,variant),cached=memoryImages.get(key);
    if(cached){memoryImages.delete(key);memoryImages.set(key,cached);return Promise.resolve(cached.data);}
    const existing=pendingImages.get(key);
    if(existing){if(priority>existing.priority){existing.priority=priority;imageQueue.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);}return existing.promise;}
    let resolve;
    const promise=new Promise((done)=>{resolve=done;});
    const task={key,url,variant,priority,preload,sequence:imageSequence++,resolve,promise};
    pendingImages.set(key,task);imageQueue.push(task);imageQueue.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);pumpImageQueue();
    return promise;
  }
  function pumpImageQueue() {
    while(activeImageLoads<2&&imageQueue.length){
      const index=imageQueue.findIndex((task)=>!task.preload||activeImagePreloads<1);
      if(index<0)break;
      const [task]=imageQueue.splice(index,1);activeImageLoads++;if(task.preload)activeImagePreloads++;
      window.__TAURI__.core.invoke('catalog_image',{url:task.url,variant:task.variant}).then((data)=>{
        if(data)rememberImage(task.key,data);task.resolve(data||null);
      }).catch(()=>task.resolve(null)).finally(()=>{
        pendingImages.delete(task.key);activeImageLoads--;if(task.preload)activeImagePreloads--;pumpImageQueue();
      });
    }
  }
  function setCirclePreloads(urls) {
    const active=new Set(urls);
    for(let i=imageQueue.length-1;i>=0;i--){
      const task=imageQueue[i];
      if(task.preload&&!active.has(task.url)){imageQueue.splice(i,1);pendingImages.delete(task.key);task.resolve(null);}
    }
    for(const url of active)requestCatalogImage(url,'original',5,true);
  }
  function updateViewerTransform(smooth=false) {
    if(!viewerImage)return;
    viewerImage.classList.toggle('is-smooth',smooth);
    viewerImage.style.transform='translate3d('+viewerX+'px, '+viewerY+'px, 0) scale('+viewerScale+')';
  }
  function zoomViewerAt(clientX,clientY,nextScale) {
    const rect=imageViewer.getBoundingClientRect();
    const pointX=clientX-rect.left-rect.width/2,pointY=clientY-rect.top-rect.height/2;
    const imageX=(pointX-viewerX)/viewerScale,imageY=(pointY-viewerY)/viewerScale;
    viewerScale=Math.min(5,Math.max(1,nextScale));
    viewerX=pointX-imageX*viewerScale;viewerY=pointY-imageY*viewerScale;
    if(viewerScale===1){viewerX=0;viewerY=0;}
    updateViewerTransform(true);
  }
  function closeImageViewer() {
    if(imageViewer)imageViewer.hidden=true;
    viewerPointers.clear();viewerScale=1;viewerX=0;viewerY=0;viewerPinchDistance=0;viewerPinched=false;viewerGestureMoved=false;viewerLastTap=0;updateViewerTransform(false);
  }
  function openImageViewer(src,alt,url) {
    if(!imageViewer){
      imageViewer=node('div','comi-image-viewer');imageViewer.hidden=true;
      imageViewer.innerHTML='<button type="button" class="comi-image-viewer-close">×</button><img class="comi-image-viewer-image" draggable="false">';
      document.body.append(imageViewer);viewerImage=imageViewer.querySelector('img');
      imageViewer.addEventListener('click',(event)=>{if(event.target===imageViewer)closeImageViewer();});
      imageViewer.querySelector('button').addEventListener('click',closeImageViewer);
      viewerImage.addEventListener('pointerdown',(event)=>{
        event.preventDefault();viewerImage.setPointerCapture(event.pointerId);
        viewerPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(viewerPointers.size===2){
          const p=[...viewerPointers.values()],rect=imageViewer.getBoundingClientRect();
          const midX=(p[0].x+p[1].x)/2-rect.left-rect.width/2,midY=(p[0].y+p[1].y)/2-rect.top-rect.height/2;
          viewerPinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);viewerPinchScale=viewerScale;
          viewerPinchAnchorX=(midX-viewerX)/viewerScale;viewerPinchAnchorY=(midY-viewerY)/viewerScale;
          viewerPinched=true;viewerGestureMoved=true;viewerLastTap=0;
        }
      });
      viewerImage.addEventListener('pointermove',(event)=>{
        const previous=viewerPointers.get(event.pointerId);if(!previous)return;
        const next={x:event.clientX,y:event.clientY};viewerPointers.set(event.pointerId,next);
        if(viewerPointers.size===2&&viewerPinchDistance>0){
          const p=[...viewerPointers.values()],rect=imageViewer.getBoundingClientRect();
          const distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
          viewerScale=Math.min(5,Math.max(1,viewerPinchScale*distance/viewerPinchDistance));
          const midX=(p[0].x+p[1].x)/2-rect.left-rect.width/2,midY=(p[0].y+p[1].y)/2-rect.top-rect.height/2;
          viewerX=midX-viewerPinchAnchorX*viewerScale;viewerY=midY-viewerPinchAnchorY*viewerScale;
          if(viewerScale===1){viewerX=0;viewerY=0;}
        }else if(viewerPointers.size===1){
          const dx=next.x-previous.x,dy=next.y-previous.y;
          if(Math.abs(dx)+Math.abs(dy)>2){viewerGestureMoved=true;viewerLastTap=0;}
          if(viewerScale>1){viewerX+=dx;viewerY+=dy;}
        }
        updateViewerTransform(false);
      });
      const release=(event)=>{
        const point=viewerPointers.get(event.pointerId);viewerPointers.delete(event.pointerId);
        if(viewerPointers.size<2)viewerPinchDistance=0;
        if(viewerPointers.size===0){
          const now=performance.now();
          if(point&&!viewerGestureMoved&&!viewerPinched){
            if(now-viewerLastTap<320){zoomViewerAt(point.x,point.y,viewerScale>1?1:2.5);viewerLastTap=0;}
            else{viewerLastTap=now;}
          }
          viewerGestureMoved=false;viewerPinched=false;
        }
      };
      viewerImage.addEventListener('pointerup',release);viewerImage.addEventListener('pointercancel',release);
      imageViewer.addEventListener('wheel',(event)=>{event.preventDefault();zoomViewerAt(event.clientX,event.clientY,viewerScale+(event.deltaY<0?.25:-.25));},{passive:false});
      document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&imageViewer&&!imageViewer.hidden)closeImageViewer();});
    }
    viewerImage.src=src||'';viewerImage.alt=alt||t('boothCatalog');viewerImage.dataset.sourceUrl=url||'';viewerPointers.clear();viewerScale=1;viewerX=0;viewerY=0;viewerPinchDistance=0;viewerPinched=false;viewerGestureMoved=false;viewerLastTap=0;updateViewerTransform(false);imageViewer.hidden=false;
    if(url)requestCatalogImage(url,'original',100,false).then((data)=>{if(data&&!imageViewer.hidden&&viewerImage.dataset.sourceUrl===url)viewerImage.src=data;});
  }
  function renderBoothItems(items,append,message) {
    const section=boothSection();if(!section)return;
    const root=section.querySelector('.comi-booth-groups');if(!append)root.replaceChildren();
    if(message){root.replaceChildren(node('p','comi-shop-message',message));renderBoothLabels();return;}
    if(!items.length&&!append){root.append(node('p','comi-shop-message',t('empty')));renderBoothLabels();return;}
    const groups=new Map();
    for(const item of items){
      const image=item.imageSource||('missing:'+item.id);
      if(!groups.has(image))groups.set(image,[]);
      groups.get(image).push(item);
    }
    for(const [image,groupItems] of groups){
      const card=node('article','comi-booth-group'),media=node('div','comi-booth-media');
      if(image.startsWith('https://pbs.twimg.com/media/')){
        const img=node('img','comi-booth-image');img.dataset.sourceUrl=image;img.alt=groupItems[0].name||t('boothCatalog');img.loading='lazy';img.title=t('boothCatalog');img.addEventListener('click',()=>openImageViewer(img.currentSrc||img.src,img.alt,image));media.append(img);
        requestCatalogImage(image,'thumbnail',50,true).then((data)=>{if(data&&img.isConnected)img.src=data;else if(media.isConnected&&!img.src)media.append(node('span','comi-booth-image-fallback',t('imageUnavailable')));});
      }else media.append(node('span','comi-booth-image-fallback',t('imageUnavailable')));
      card.append(media);
      const rows=node('div','comi-booth-products');
      for(const item of groupItems){
        const row=node('div','comi-booth-product'),details=node('div','comi-booth-product-details');
        row.dataset.itemId=item.id;
        details.append(node('strong','comi-shop-item-name',item.name||'—'),node('span','comi-shop-price',item.priceText||price(item.priceAmount,item.currency)));
        const controls=node('div','comi-booth-quantity');
        const minus=node('button','comi-booth-qty-button comi-booth-minus','−');minus.type='button';minus.setAttribute('aria-label',t('minus'));minus.addEventListener('click',()=>change(item.id,-1));
        const quantity=node('span','comi-booth-qty-value',String(cart.find((entry)=>entry.item.id===item.id)?.qty||0));
        const plus=node('button','comi-booth-qty-button comi-booth-plus','+');plus.type='button';plus.setAttribute('aria-label',t('plus'));plus.addEventListener('click',()=>add(item));
        const remove=node('button','comi-booth-qty-button comi-booth-remove','×');remove.type='button';remove.setAttribute('aria-label',t('remove'));remove.addEventListener('click',()=>removeFromCart(item.id));
        const hasItem=cart.some((entry)=>entry.item.id===item.id);minus.disabled=!hasItem;remove.disabled=!hasItem;
        controls.append(minus,quantity,plus,remove);row.append(details,controls);rows.append(row);
      }
      card.append(rows);
      root.append(card);
    }
    renderBoothLabels();updateBoothQuantities();
    setCirclePreloads([...root.querySelectorAll('.comi-booth-image[data-source-url]')].map((img)=>img.dataset.sourceUrl));
  }
  async function loadBoothItems(append) {
    if(boothLoading||!selectedBoothName)return;
    const section=boothSection();if(!section)return;
    boothLoading=true;const id=boothRequest;const start=append?boothOffset:0;
    section.hidden=false;section.dataset.slug=selectedBoothSlug;
    if(!append)renderBoothItems([],false,t('loading'));
    renderBoothLabels();
    try{
      const data=await window.__TAURI__.core.invoke('catalog_items',{query:'',booth:selectedBoothName,offset:start});
      if(id!==boothRequest)return;
      boothMore=Boolean(data.hasMore);boothOffset=start+data.items.length;renderBoothItems(data.items,append,null);
    }catch{if(id===boothRequest)renderBoothItems([],append,t('error'));}
    finally{if(id===boothRequest){boothLoading=false;renderBoothLabels();}}
  }
  function refreshSelectedBooth() {
    const slug=new URLSearchParams(location.hash.slice(1)).get('c')||'';
    const section=boothSection();
    if(!slug){selectedBoothSlug='';selectedBoothName='';boothRequest++;boothLoading=false;if(section)section.hidden=true;return;}
    const title=document.querySelector('#ttl'),name=title?.textContent.trim();
    if(!name)return;
    const changed=slug!==selectedBoothSlug||name!==selectedBoothName;
    if(changed){selectedBoothSlug=slug;selectedBoothName=name;boothOffset=0;boothMore=false;boothLoading=false;boothRequest++;setCirclePreloads([]);}
    if(section){section.hidden=false;renderBoothLabels();}
    if(changed||section?.dataset.slug!==slug)loadBoothItems(false);
  }
  function installBoothWatch() {
    if(boothWatchInstalled)return;boothWatchInstalled=true;
    window.addEventListener('hashchange',refreshSelectedBooth);
    document.addEventListener('click',(event)=>{
      if(event.target.closest?.('a[href*="#c="]'))setTimeout(refreshSelectedBooth,80);
    },true);
    const attachTitle=()=>{
      const title=document.querySelector('#ttl');
      if(!title||boothTitleObserver?.target===title)return;
      boothTitleObserver?.disconnect();
      boothTitleObserver=new MutationObserver(refreshSelectedBooth);
      boothTitleObserver.target=title;
      boothTitleObserver.observe(title,{childList:true,characterData:true,subtree:true});
    };
    attachTitle();
    new MutationObserver(attachTitle).observe(document.documentElement,{childList:true,subtree:true});
    refreshSelectedBooth();
  }
  async function fetchItems(append) {
    if(loading)return;loading=true;const id=++request;const start=append?offset:0;
    const more=document.querySelector('#'+dialogId+' .comi-shop-more');if(more)more.hidden=true;
    if(!append)renderResults([],false,t('loading'));
    try {
      const data=await window.__TAURI__.core.invoke('catalog_items',{query,booth:'',offset:start});if(id!==request)return;
      hasMore=Boolean(data.hasMore);offset=start+data.items.length;renderResults(data.items,append,null);
    } catch {if(id===request)renderResults([],append,t('error'));}
    finally {if(id===request){loading=false;const button=document.querySelector('#'+dialogId+' .comi-shop-more');if(button)button.hidden=!hasMore;}}
  }
  function open() {build();const d=document.getElementById(dialogId);if(d&&!d.open){d.showModal();fetchItems(false);}}
  function install() {
    if(!document.getElementById('comi-shopping-style')){const style=node('style');style.id='comi-shopping-style';style.textContent=CSS;document.head.append(style);}
    build();const controls=document.querySelector('#ctl');
    if(controls&&!document.getElementById('comi-inventory-control')){
      const group=node('div','ctl-g plate');group.id='comi-inventory-control';
      const button=node('button');button.type='button';button.innerHTML=ICON;button.title=t('map');button.setAttribute('aria-label',t('map'));button.addEventListener('click',open);
      group.append(button);controls.insertBefore(group,controls.firstElementChild);
    }
    installBoothWatch();
  }
  install();
  new MutationObserver((records)=>{if(records.some((r)=>r.type==='attributes'&&r.target===document.documentElement&&r.attributeName==='lang')){labels();renderBoothLabels();const b=document.querySelector('#comi-inventory-control button');if(b){b.title=t('map');b.setAttribute('aria-label',t('map'));}}install();})
    .observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['lang']});
})();
