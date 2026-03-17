import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function Report({ isLoggedIn, onLogout }){

return(

<div style={styles.page}>

<Navbar isLoggedIn={isLoggedIn} onLogout={onLogout}/>

<div style={styles.body}>

<Sidebar currentStep="report"/>

<main style={styles.main}>

<h1 style={styles.title}>ESG 분석 결과</h1>

<div style={styles.grid}>

<div style={styles.card}>
<h3>환경 (E)</h3>
<p>탄소 배출 감소 전략 필요</p>
</div>

<div style={styles.card}>
<h3>사회 (S)</h3>
<p>산업안전 개선 필요</p>
</div>

<div style={styles.card}>
<h3>지배구조 (G)</h3>
<p>이사회 독립성 강화</p>
</div>

</div>

</main>

</div>

</div>

)

}

const styles={

page:{minHeight:"100vh",background:"#f8f9fa",display:"flex",flexDirection:"column"},

body:{display:"flex",flex:1},

main:{flex:1,padding:"44px 48px"},

title:{fontSize:26,fontWeight:700,marginBottom:30},

grid:{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
gap:20
},

card:{
background:"white",
padding:24,
borderRadius:16,
boxShadow:"0 2px 16px rgba(0,0,0,0.05)"
}

}

export default Report