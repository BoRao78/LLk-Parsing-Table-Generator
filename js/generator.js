/*!
 * LL(k) Parsing Table Generator
 * https://github.com/Gals42/LLk-Parsing-Table-Generator
 * Author: Radim Kocman
 */


////
// GRAMMAR OBJECTS
//////

var GType = {
  T : 1, // terminal
  N : 2, // nonterminal
  
  A : 3, // abstract term
  V : 4  // value term
};

var GElement = function(value, type) {
  this.value = value;
  this.type = type;
};

var GRule = function() {
  this.left;
  this.right = [];
};
GRule.prototype.setLeft = function(gelement) {
  this.left = gelement;
};
GRule.prototype.addRight = function(gelement) {
  this.right.push(gelement);
};

var Grammar = function() {
  this.T = [];
  this.R = [];
};
Grammar.prototype.addT = function(gelement) {
  this.T.push(gelement);
};
Grammar.prototype.addR = function(grule) {
  this.R.push(grule);
};
Grammar.prototype.startN = function() {
  return this.R[0].left;
};


////
// PARSING TABLE GENERATOR GUI
//////

var StatusClass = {
  INFO : "info",
  OK : "ok",
  ERROR : "error"
};

var PTGConfig = {
  FULL : "full",
  COMPACT : "compact"
};

var PTG = {

  inputG : undefined,
  k : undefined,
  config : undefined,

  run: function() {
    this.setInfo("Processing...");
    out.clean();
    
    if (!this.handleInputForm()) return;
    
    if (!this.handleInputParse()) return;
    if (this.config === PTGConfig.FULL ||
        ParserHandler.status !== PHStatus.OK) {
      out.title("Parsed Rules");
      out.grammar(ParserHandler.IG);
    }
    if (!this.handleInputSemanticErrors()) return;
    
    TableGenerator.construct(ParserHandler.IG);
    if (this.config === PTGConfig.FULL) {
      out.title("LL(k) Tables");
      for (var i = 0; i < TableGenerator.LLks.length; i++) {
        out.llkT(TableGenerator.LLks[i]);
      }
    }
    
    this.setOk("OK");
  },
  
  handleInputForm: function() {
    
    this.k = parseInt($("input[name=k]").val());
    if (isNaN(this.k) || this.k < 1 || this.k > 100) {
      this.setError("Error: Invalid k");
      return false;
    }
    
    this.config = $("select[name=result]").val();
    if (this.config !== PTGConfig.FULL && this.config !== PTGConfig.COMPACT) {
      this.setError("Error: Invalid output selection");
      return false;
    }
    
    this.inputG = $("textarea[name=grammar]").val();
    if (this.inputG.length === 0) {
      this.setError("Error: Empty input grammar");
      return false;
    }
    
    return true;
  },
  
  handleInputParse: function() {
    ParserHandler.start();
    try {
      parser.parse(this.inputG);
    } catch (err) {
      this.setError("Error: Invalid input grammar (error on line "+err+")");
      return false;
    }
      
    return true;
  },
  
  handleInputSemanticErrors: function() {
    if (ParserHandler.status === PHStatus.FAILN) {
      this.setError("Error: Invalid input grammar \
        (rule with terminal "+ParserHandler.statusText+" on the left side)");
      return false;
    }
    
    if (ParserHandler.status === PHStatus.FAILRD) {
      this.setError("Error: Invalid input grammar \
        (duplicate rules for nonterminal "+ParserHandler.statusText+")");
      return false;
    }
    
    if (ParserHandler.status === PHStatus.FAILRM) {
      this.setError("Error: Invalid input grammar \
        (missing rule for nonterminal "+ParserHandler.statusText+")");
      return false;
    }
    
    if (ParserHandler.status === PHStatus.FAILRL) {
      this.setError("Error: Invalid input grammar \
        (left recursion with nonterminal "+ParserHandler.statusText+")");
      return false;
    }
    
    return true;
  },

  statusBar: undefined,
  setInfo: function(msg) {
    this.statusBar.text(msg);
    this.statusBar.attr("class", StatusClass.INFO);
  },
  setOk: function(msg) {
    this.statusBar.text(msg);
    this.statusBar.attr("class", StatusClass.OK);
  },
  setError: function(msg) {
    this.statusBar.text(msg);
    this.statusBar.attr("class", StatusClass.ERROR);
  }

};
$(function() {
  PTG.statusBar = $("#status span");
});


////
// CONTENT SELECT HELPER
//////

function select_all(el) {
  if (typeof window.getSelection !== "undefined" && 
      typeof document.createRange !== "undefined") {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (typeof document.selection !== "undefined" && 
    typeof document.body.createTextRange !== "undefined") {
    var textRange = document.body.createTextRange();
    textRange.moveToElementText(el);
    textRange.select();
  }
}


////
// INPUT PARSER MODIFICATION
//////

parser.yy.parseError = function parseError(str, hash) {
    throw hash.line+1;
};


////
// INPUT PARSER HANDLER
//////

var PHStatus = {
  OK : 0,
  FAILN : 1,  // Fail terminal 
  FAILRD : 2, // Duplicate rule
  FAILRM : 3, // Missing rule
  FAILRL : 4  // Left recursive rule
};

var ParserHandler = {
  
  IG : undefined,
  status : PHStatus.OK,
  statusText : "",
  halves : undefined,
  
  start : function() {
    this.IG = new Grammar();
    this.status = PHStatus.OK;
    this.statusText = "";
    this.halves = [];
  },
  
  setT : function(array) {
    for (var i = 0; i < array.length; i++) {
      array[i].type = GType.T;
      this.IG.addT(array[i]);
    }
  },
  
  convert : function(el) {
    if (el.type === GType.V) {
      el.type = GType.T;
      return el;
    }
    
    el.type = GType.N;
    for (var i = 0; i < this.IG.T.length; i++) {
      if (el.value === this.IG.T[i].value) {
        el.type = GType.T;
        break;
      }
    }
    return el;
  },
  
  setHalfR : function(right) {
    var rule = new GRule();
    for (var i = 0; i < right.length; i++) {
      var el = this.convert(right[i]);
      rule.addRight(el);
    }
    this.halves.push(rule);
  },
  
  setR : function(left, right) {
    var lel = this.convert(left);
    
    // Test nonterminal on the left side
    if (lel.type === GType.T) {
      this.status = PHStatus.FAILN;
      this.statusText = lel.value;
    }
    
    // Rule
    var rule = new GRule();
    rule.setLeft(lel);
    for (var i = 0; i < right.length; i++) {
      var el = this.convert(right[i]);
      rule.addRight(el);
    }
    this.IG.addR(rule);
    
    // Finish halves
    for (var i = this.halves.length-1; i >= 0; i--) {
      rule = this.halves[i];
      rule.setLeft(lel);
      this.IG.addR(rule);
    }
    this.halves = [];
  },
  
  finish : function() {
    
    if (this.status !== PHStatus.OK) return;
    
    // Test duplicate rules
    if (!this.testDuplicate()) return;
    
    // Test nonterminals without rules
    if (!this.testMissing()) return;
    
    // Test left recursion
    this.testLeftRecursion();
    
  },
  
  testDuplicate : function() {
    var rulei, rulej, same;
    for (var i = 0; i < this.IG.R.length; i++) {
      rulei = this.IG.R[i];
      
      for (var j = 0; j < this.IG.R.length; j++) {
        rulej = this.IG.R[j];
        
        if (i === j) continue;
        if (rulei.left.value !== rulej.left.value) continue;
        if (rulei.right.length !== rulej.right.length) continue;
        
        same = true;
        for (var k = 0; k < rulei.right.length; k++) {
          if (rulei.right[k].value !== rulej.right[k].value) same = false;
        }
        if (same) { 
          this.status = PHStatus.FAILRD;
          this.statusText = rulei.left.value;
          return false;
        }
      }
    }
    return true;
  },
  
  testMissing : function() {
    var rulei, elj, found;
    var onleft = [];
    var onright = [];
    
    // fill arrays
    for (var i = 0; i < this.IG.R.length; i++) {
      rulei = this.IG.R[i];
      onleft.push(rulei.left.value);
      
      for (var j = 0; j < rulei.right.length; j++) {
        elj = rulei.right[j];
        if (elj.type === GType.N)
          onright.push(elj.value);
      }
    }
    
    // check for missing
    for (var i = 0; i < onright.length; i++) {
      found = false;
      for (var j = 0; j < onleft.length; j++) {
        if (onright[i] === onleft[j]) {
          found = true;
          break;
        }
      }
      if (!found) {
        this.status = PHStatus.FAILRM;
        this.statusText = onright[i];
        return false;
      }
    }
    
    return true;
  },
  
  prepareEmptySet : function() {
    var rulei, elj;
    var olds = [];
    var news = [];
    
    do {
      olds = news;
      news = [];
      
      for (var i = 0; i < this.IG.R.length; i++) {
        rulei = this.IG.R[i];
        
        // count rules with eps
        if (rulei.right.length === 0) {
          news.push(rulei.left.value);
          continue;
        }
        
        // count rules with all eps nonterminals
        for (var j = 0; j < rulei.right.length; j++) {
          elj = rulei.right[j];
          
          if (elj.type === GType.T) 
            break;
          
          if ($.inArray(elj.value, olds) !== -1) {
            if (j !== rulei.right.length-1)
              continue;
            else
              news.push(rulei.left.value);
          }
          
          break;
        }
      }
      
    } while (olds.length !== news.length);
    
    return news;
  },
  
  testLeftRecursion : function() {
    var rulei, elj;
    var empty = this.prepareEmptySet();
    
    for (var i = 0; i < this.IG.R.length; i++) {
      rulei = this.IG.R[i];
      
      for (var j = 0; j < rulei.right.length; j++) {
        elj = rulei.right[j];
        
        if (elj.type === GType.T) break;
        
        this.testLeftRecusion_cont([], elj.value, empty);
        
        if ($.inArray(elj.value, empty) === -1) break;
      }
    }
  },
  
  testLeftRecusion_cont : function(before, current, empty) {
    var rulei, elj;
    
    if ($.inArray(current, before) !== -1) {
      this.status = PHStatus.FAILRL;
      this.statusText = current;
      return;
    }
    
    before = before.concat([current]);
    
    for (var i = 0; i < this.IG.R.length; i++) {
      rulei = this.IG.R[i];
      
      if (rulei.left.value !== current) continue;
      
      for (var j = 0; j < rulei.right.length; j++) {
        elj = rulei.right[j];
        
        if (elj.type === GType.T) break;
        
        this.testLeftRecusion_cont(before, elj.value, empty);
        
        if ($.inArray(elj.value, empty) === -1) break;
      }
    }
  }
  
};


////
// OUTPUT PRINTER
//////

var out = {
  
  out: undefined,
  
  clean: function() {
    this.out.html("");
  },
  
  title: function(text) {
    var html = "<h2>"+text+"</h2>";
    this.out.html(this.out.html() + html);
  },
  
  grammar: function(g) {
    var html = "<div class=\"code2\">";
    for (var i = 0; i < g.R.length; i++) {
      html += this.prepRule(g.R[i])+"<br>";
    }
    html += "</div>";
    this.out.html(this.out.html() + html);
  },
  
  prepRule: function(r) {
    var html = 
      this.prepEl(r.left)+ "→ ";
    if (r.right.length === 0)
      html += "<span class=\"eps\">ε</span> ";
    for (var i = 0; i < r.right.length; i++) {
      html += this.prepEl(r.right[i]);
    }
    return html;
  },
  
  prepEl: function(e, nospace) {
    var html = 
      "<span class=\""+((e.type === GType.N)?"n":"t")+"\">"
      +e.value+"</span>"+((nospace)? "" : " ");
    return html; 
  },
  
  llkT: function(t) {
    var html = "<table class=\"llkt\">";
    html += "<caption>Table T<sub>"+t.number+"</sub> (T<sub>";
    html += this.prepEl(t.N, true)+",{";
    if (t.L.str.length === 0)
      html += "<span class=\"eps\">ε</span>";
    for (var i = 0; i < t.L.str.length; i++) {
      html += this.prepEl(t.L.str[i], true);
      if (i !== t.L.str.length-1)
        html += " ";
    }
    html += "}</sub>)</caption>";
    html += "<tr><th>u</th><th>Production</th><th>Follow</th></tr>";
    var rowi, folj, uelj;
    for (var i = 0; i < t.rows.length; i++) {
      rowi = t.rows[i];
      
      html += "<tr><td>";
      if (rowi.u.str.length === 0)
        html += "<span class=\"eps\">ε</span>";
      for (var j = 0; j < rowi.u.str.length; j++) {
        uelj = rowi.u.str[j];
        html += this.prepEl(uelj);
      }
      
      html += "</td><td>"+this.prepRule(rowi.prod)+"</td><td>";
      
      if (rowi.follow.length === 0)
        html += "<span class=\"emptyf\">-</span>";
      for (var j = 0; j < rowi.follow.length; j++) {
        folj = rowi.follow[j];
        html += this.prepFollow(folj)+" ";
      }
      html += "</td></tr>";
    }
    html += "</table>";
    this.out.html(this.out.html() + html);
  },
  
  prepFollow: function(f) {
    var html =
      this.prepEl(f.N, true)+":{";
    for (var i = 0; i < f.sets.length; i++) {
      if (f.sets[i].str.length === 0)
        html += "<span class=\"eps\">ε</span>";
      for (var j = 0; j < f.sets[i].str.length; j++) {
        html += this.prepEl(f.sets[i].str[j], true);
        if (j !== f.sets[i].str.length-1)
          html += " ";
      }
      if (i !== f.sets.length-1) html += ", ";
    }
    html += "}";
    return html;
  }
  
};
$(function() {
  out.out = $("#output");
});


////
// LL(k) PARSING TABLE GENERATOR
//////

var FollowEl = function(N, sets) {
  this.N = N;
  this.sets = sets;
};

var LLkTRow = function(u, prod, F) {
  this.u = u;
  this.prod = prod;
  this.follow = F;
};

var LLkT = function(count, A, L) {
  this.name = "T"+count;
  this.number = count;
  
  this.N = A;
  this.L = L;
  
  this.rows = [];
};
LLkT.prototype.addRow = function(row) {
  this.rows.push(row);
};
LLkT.prototype.toFlat = function() {
  var flat = "T "+this.N.value+", {";
  for (var i = 0; i < this.L.str.length; i++) {
    flat += this.L.str[i].value;
    if (i !== this.L.str.length-1)
      flat += " ";
  }
  flat += "}";
  return flat;
};

var FirstKEl = function(k) {
  this.leftk = k;
  this.k = 0;
  this.str = [];
};
FirstKEl.prototype.addGEl = function(gelement) {
  this.leftk--;
  this.k++;
  this.str.push(gelement);
};
FirstKEl.prototype.clone = function() {
  return jQuery.extend(true, {}, this);
};
FirstKEl.prototype.toFlat = function() {
  var flat = "";
  for (var i = 0; i < this.str.length; i++) {
    flat += this.str[i].value;
    if (i !== this.str.length-1)
      flat += " ";
  }
  return flat;
};

var TableGenerator = {
  
  IG: undefined,
  LLks: [],
  Tcounter: 0,
  
  construct: function(IG) {
    this.IG = IG;
    this.Tcounter = 0;
    this.LLks = [];
    
    this.constructLLkTs();
    
    //(...)
  },
  
  constructLLkTs: function() {
    //(1)
    var t0 = this.constructLLkT(this.IG.startN(), new FirstKEl(PTG.k));
    this.LLks.push(t0);
    
    //(2)
    var J = [t0];
    
    //(3)(4)
    var tabi, rowj, folk, setl, newt, newtf;
    for (var i = 0; i < this.LLks.length; i++) {
      tabi = this.LLks[i];
      for (var j = 0; j < tabi.rows.length; j++) {
        rowj = tabi.rows[j];
        for (var k = 0; k < rowj.follow.length; k++) {
          folk = rowj.follow[k];
          for (var l = 0; l < folk.sets.length; l++) {
            setl = folk.sets[l];
            
            newt = new LLkT(0, folk.N, setl);
            newtf = newt.toFlat();
            if ($.inArray(newtf, J) === -1) {
              newt = this.constructLLkT(folk.N, setl);
              this.LLks.push(newt);
              J.push(newtf);
            }
          }
        }
      }
    }
  },
  
  constructLLkT: function(N, L) {
    var table = new LLkT(this.Tcounter, N, L);
    this.Tcounter++;
    
    var first, setu, rulei, nrow, follow;
    for (var i = 0; i < this.IG.R.length; i++) {
      rulei = this.IG.R[i];
      
      // skip irrelevant rules
      if (rulei.left.value !== N.value) continue;
      
      // compute u
      first = this.firstOp(rulei.right);
      setu = this.firstPlusOp(first, [L]);
      
      // compute follow
      follow = this.followOp(rulei.right, L);
      
      // add rows
      for (var j = 0; j < setu.length; j++) {
        nrow = new LLkTRow(setu[j], rulei, follow);
        table.addRow(nrow);
      }
    }
    
    return table;
  },
  
  firstOp: function(right) {
    var set = [new FirstKEl(PTG.k)];
    var set2 = [];
    
    for (var i = 0; i < right.length; i++) {
      for (var j = 0; j < set.length; j++) {
        
        // only uncomplete
        if (set[j].leftk <= 0) {
          set2.push(set[j]);
          continue;
        }
        
        // add terminals
        if (right[i].type === GType.T) {
          set[j].addGEl(right[i]);
          set2.push(set[j]);
          continue;
        }
        
        // expand nonterminals
        set2 = set2.concat(this.firstOp_exp(set[j], right[i]));
        
      }
      set = set2;
      set2 = [];
    }
    
    return set;
  },
  
  firstOp_exp: function(el, N) {
    var set = [el.clone()];
    var set2 = [];
    var set3 = [];
    
    for (var r = 0; r < this.IG.R.length; r++) {
      var cr = this.IG.R[r];
      
      // skip irrelevant rules
      if (cr.left.value !== N.value) continue;
      
      for (var i = 0; i < cr.right.length; i++) {
        for (var j = 0; j < set.length; j++) {
          
          // only uncomplete
          if (set[j].leftk <= 0) {
            set2.push(set[j]);
            continue;
          }
          
          // add terminals
          if (cr.right[i].type === GType.T) {
            set[j].addGEl(cr.right[i]);
            set2.push(set[j]);
            continue;
          }
          
          // expand nonterminals
          set2 = set2.concat(this.firstOp_exp(set[j], cr.right[i]));
          
        }
        set = set2;
        set2 = [];
      }
      
      set3 = set3.concat(set);
      set = [el.clone()];
      set2 = [];
    }
    
    return set3;
  },
  
  firstPlusOp: function(set1, set2) {
    var ip, jp, fel;
    var result = [];
    var resultcheck = [];
    
    for (var i = 0; i < set1.length; i++) {
      for (var j = 0; j < set2.length; j++) {
        ip = 0; jp = 0; fel = new FirstKEl(PTG.k);
        for (var k = 0; k < PTG.k; k++) {
          if (ip < set1[i].str.length) {
            fel.addGEl(set1[i].str[ip]);
            ip++;
            continue;
          }
          if (jp < set2[j].str.length) {
            fel.addGEl(set2[j].str[jp]);
            jp++;
            continue;
          }
          break;
        }
        if ($.inArray(fel.toFlat(), resultcheck) === -1) {
          result.push(fel);
          resultcheck.push(fel.toFlat());
        }
      }
    }
    
    return result;
  },
  
  followOp: function(right, L) {
    var result = [];
    var eli, rest, follow;
    var first, setu;
    
    for (var i = 0; i < right.length; i++) {
      eli = right[i];
      
      // skip terminals
      if (eli.type === GType.T) continue;
      
      // create rest
      rest = [];
      for (var j = i+1; j < right.length; j++) {
        rest.push(right[j]);
      }
      
      // compute u
      first = this.firstOp(rest);
      setu = this.firstPlusOp(first, [L]);
      
      // add to result
      follow = new FollowEl(eli, setu);
      result.push(follow);
    }
    
    return result;
  }
  
};