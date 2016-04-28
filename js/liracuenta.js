'use strict';
var liracuenta = (function () {
  var db,idb;
  var init = function () {
    openDatabase();
    bindEvents();
  };
  var openDatabase = function () {
    idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    db = idb.open('liradb',1);
    db.onupgradeneeded = function () {
      var pointer = db.result;
      var tr = pointer.createObjectStore('transacciones',{keyPath:'id',autoIncrement:true});
      tr.createIndex('by_day','dia',{unique:false});
      tr.createIndex('by_month','mes',{unique:false});
    };
    db.onsuccess = function (e) {
      console.log('Base de datos cargada correctamente');
    };
    db.onerror = function (e) {
      Lobibox.notify('error',{size:'mini',rounded:true,msg:'Error cargando la base de datos'});
    };
  };
  var genDate = function (f) {
    var m = f.getMonth()+1, d = f.getDate(), y = f.getFullYear();
    return y+'-'+((m<10?'0':'')+m)+'-'+((d<10?'0':'')+d);
  };
  var getLastWeek = function () {
    var today = new Date();
    var last = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    return genDate(last);
  };
  var getLastMonth = function () {
    var today = new Date();
    var last = new Date(today.getFullYear(), today.getMonth()-1, today.getDate());
    return genDate(last);
  };
  var getToday = function () {
    return genDate(new Date());
  };
  var resetDB = function () {
    var pointer = db.result;
    var data = pointer.transaction(['transacciones'],'readwrite');
    var obj = data.objectStore('transacciones');
    var objrequest = obj.clear();
    objrequest.onsuccess = function (e) {
      Lobibox.notify('success',{size:'mini',rounded:true,msg:'Datos eliminados'});
      openDatabase();
      balanceTotal();
    };
  };
  var ingresarTransaccion = function (valor,tipo) {
    var pointer = db.result;
    var data = pointer.transaction(['transacciones'],'readwrite');
    var obj = data.objectStore('transacciones');
    var d = new Date();
    var request = obj.put({mes: d.getMonth()+1,dia: d.getDate(),anio: d.getFullYear(),valor: valor,signo: tipo});
    request.onerror = function (e) {
      Lobibox.notify('error',{size:'mini',rounded:true,msg:request.error.name + '\n\n' + request.error.message});
    };
    data.oncomplete = function (e) {
      Lobibox.notify('success',{size:'mini',rounded:true,msg:'Transaccion ingresada'});
      balanceTotal();
    };
  };
  var listarTipo = function (tipo) {
    document.querySelector('.js-reporte').innerHTML = 'Procesando...';
    var pointer = db.result;
    var data = pointer.transaction(['transacciones'],'readonly');
    var object = data.objectStore('transacciones');
    var elements = [];
    object.openCursor().onsuccess = function (e) {
      var result = e.target.result;
      if(result===null) return;
      elements.push(result.value);
      result.continue();
    };
    data.oncomplete = function () {
      var total = 0;
      var clase = ['d&iacute;a','semana','mes'];
      var html = '';
      var template = Handlebars.compile(document.querySelector('#fila-reporte').innerHTML);
      var strdia = (tipo==0?getToday():(tipo==1?getLastWeek():getLastMonth()));
      for(var k=0;k<elements.length;k++){
        var obj = elements[k];
        if(obj.valor!=null){
          var strfecha = obj.anio+'-'+(obj.mes<10?'0':'')+obj.mes+'-'+(obj.dia<10?'0':'')+obj.dia;
          if(tipo==0 && strdia == strfecha){
            total += (obj.valor*1*obj.signo);
            html += template({
              clase: obj.signo==-1?'danger':'success',
              fecha: strfecha,
              valor: accounting.formatMoney(obj.valor)
            });
          }
          else if(tipo>=1 && strdia <= strfecha){
            total += (obj.valor*1*obj.signo);
            html += template({
              clase: obj.signo==-1?'danger':'success',
              fecha: strfecha,
              valor: accounting.formatMoney(obj.valor)
            });
          }
        }
      }
      if(html==''){
        template = Handlebars.compile(document.querySelector('#fila-vacia').innerHTML);
        html = template({});
      }
      template = Handlebars.compile(document.querySelector('#tabla-reporte').innerHTML);
      var cod = template({tipo:clase[tipo],filas:html,cltotal:total<=0?(total==0?'warning':'danger'):'success',total:accounting.formatMoney(total)});
      document.querySelector('.js-reporte').innerHTML = cod;
    };
  };
  var balanceTipo = function (tipo) {
    var total = 0;
    var pointer = db.result;
    var data = pointer.transaction(['transacciones'],'readonly');
    var object = data.objectStore('transacciones');
    var elements = [];
    object.openCursor().onsuccess = function (e) {
      var result = e.target.result;
      if(result===null) return;
      elements.push(result.value);
      result.continue();
    };
    data.oncomplete = function () {
      var clase = ['.js-day-resume','.js-week-resume','.js-month-resume'];
      var elem = document.querySelector(clase[tipo]);
      var strdia = (tipo==0?getToday():(tipo==1?getLastWeek():getLastMonth()));
      for(var k=0;k<elements.length;k++){
        var obj = elements[k];
        var strfecha = obj.anio+'-'+(obj.mes<10?'0':'')+obj.mes+'-'+(obj.dia<10?'0':'')+obj.dia;
        if(obj.valor!=null){
          if(tipo==0 && strdia == strfecha) total += (obj.valor*1*obj.signo);
          else if(tipo>=1 && strdia <= strfecha) total += (obj.valor*1*obj.signo);
        }
      }
      elem.innerHTML = accounting.formatMoney(total);
      if(total<0) elem.className = 'danger';
      else if(total==0) elem.className = 'warning';
      else elem.className = 'success';
      elem.className += ' align-right ' + (clase[tipo].substr(1));
    };
  };
  var balanceTotal = function () {
    setTimeout(function () {
      balanceTipo(0);
      balanceTipo(1);
      balanceTipo(2);
    },1000);
  };
  var bindEvents = function () {
    document.querySelector('.js-vista-dia').onclick = function () {
      listarTipo(0);
    };
    document.querySelector('.js-vista-semana').onclick = function () {
      listarTipo(1);
    };
    document.querySelector('.js-vista-mes').onclick = function () {
      listarTipo(2);
    };
    document.querySelector('.js-ingreso').onclick = function () {
      var elem = document.querySelector('.js-valor');
      var val = elem.value;
      elem.value = 0;
      if(val!='' && val!=null) ingresarTransaccion(val,1);
    };
    document.querySelector('.js-gasto').onclick = function () {
      var elem = document.querySelector('.js-valor');
      var val = elem.value;
      elem.value = 0;
      if(val!='' && val!=null) ingresarTransaccion(val,-1);
    };
    document.querySelector('.js-reiniciar').onclick = function () {
      var cnfr = Lobibox.confirm({
        title:'Esta seguro?',msg: 'Esta accion no se puede deshacer',
        buttons:{
          ok: {'class': 'btn btn-info',text: 'Aceptar',closeOnClick: true},
          cancel: {'class': 'btn btn-danger',text: 'Cancelar',closeOnClick: true}
        },
        callback: function ($this,type,ev) {
          if(type=='ok') resetDB();
        }
      });
    };
    balanceTotal();
  };
  return {
    init: init
  };
})();
document.addEventListener("DOMContentLoaded", function(event) {
    liracuenta.init();
});
