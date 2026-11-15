/** One ephemeral presentation window. No preferences, patient inputs or dose writes.
 * A custom element owns paging, avoiding synthetic input/change events and thus
 * avoiding invalidating a prescription merely for browsing available shortcuts.
 */
let activeKey=null,page=0,renderer=null;
export function shortcutPage(key) {
  if(key!==activeKey){activeKey=key;page=0;renderer=null;}
  return page;
}
export function shortcutNavigation(key, model, render) {
  if(typeof document==='undefined')return '';
  activeKey=key;page=model.page;renderer=render;
  return `<rx-shortcut-browser><div class="shortcut-navigation" role="group" aria-label="Przeglądanie skrótów bez zmiany dawki"><button type="button" data-browse="-1" ${model.canLower?'':'disabled'}>← Mniejsze</button><button type="button" data-browse="0" ${page===0?'disabled':''}>${model.anchored?'Wg schematu':'Początkowe'}</button><button type="button" data-browse="1" ${model.canHigher?'':'disabled'}>Większe →</button></div></rx-shortcut-browser>`;
}
if(typeof customElements!=='undefined'&&!customElements.get('rx-shortcut-browser')) {
  customElements.define('rx-shortcut-browser',class extends HTMLElement {
    connectedCallback() {
      this.onclick=event=>{
        const button=event.target.closest('button[data-browse]');
        if(!button||button.disabled||!renderer)return;
        const slot=this.closest('.liquid-dose-slot');if(!slot)return;
        const direction=Number(button.dataset.browse),render=renderer;
        page=direction===0?0:page+direction;
        const html=render();slot.innerHTML=html;
        const focus=slot.querySelector(`button[data-browse="${direction}"]:not(:disabled)`)
          ||slot.querySelector('button[data-browse="0"]:not(:disabled)');
        focus?.focus({preventScroll:true});
      };
    }
  });
  document.addEventListener('click',event=>{
    const action=event.target.closest?.('[data-action]')?.dataset.action;
    if(['restore-source-values','reset'].includes(action)){activeKey=null;page=0;renderer=null;}
  },{capture:true});
}
