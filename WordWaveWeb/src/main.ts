import {App} from './app/app';
import * as events from "./app/events";
import {On, send} from "./app/events";
import {getJsonData, getTextData} from "./app/rest";
import SocketIOService from "./app/socket";
import {WordData} from "./app/DTO/WordData";

class Main {

    private app: App;
    private socket = SocketIOService()

    constructor() {
        this.app = new App()
        this.init_com()
        //@ts-ignore
        document.getElementById('btn').addEventListener('click',()=>{
            debug_text.forEach(t=>send(On.new_text, t))
        })
    }

    private init_com() {
        events.sub(On.new_text, "app", (data: WordData) =>{
            this.app.saveMeta(data.meta)
            this.app.loadWordCount(data.words)
        })

        events.sub(On.reset, "reset", (data: WordData) =>{
            this.init_com()
        })

        getJsonData('/words/current').then((data: WordData) =>{
            this.app.saveMeta(data.meta)    
            this.app.loadWordCount(data.words)
        }).catch(err => {
            console.error(err)
        })
    }

    private resize = (): void => {
        this.app.resize(window.innerWidth, window.innerHeight);
    }

}

new Main();

let debug_text = ["bah","du","coup","là","il","est","pas","remettre","en","français","directement","","en","train","d'écouter","","il","a","traduit","bah","","nous","allons","parler","du","développement","durable","","tu","peux","regarder","enceinte","en","même","temps","","ce","colloque","portera","sur","les","données","satellitaires","et","l'utilisation","que","font","les","chercheurs","aujourd'hui","de","la","data","","pour","trouver","des","solutions","aux","face","aux","enjeux","écologiques","","j'aime","bien","","ce","projet","est","porté","par","sorbonne","développement","durable","association","créée","par","Yann","Thomas","","est-ce","que","lock","met","en","dialogue","","différentes","disciplines","","pour","trouver","des","hors-jeu","","face","à","la","crise","climatique","","et","moi","je","parle","pendant","que","toi","tu","peux","regarder","le","visuel","t'embête","pas","je","vais","parler","mais","tu","devrais","voir","les","trucs","arrivés","au","fur","et","à","mesure","afficher","","je","comprends","pas","c'est","pourquoi","","pourquoi","","horloge","de","mathématiques","","ça","marche","","là","tu","vois","par","rapport","aux","mots","clés","qui","seront","évoqués","peut-être","qu'on","pourra","changer","la","police","par","rapport","au","dictionnaire","","mais","vraiment","un","effet","de","corps","céleste","quand","même","","quand","même","","ouvre","salon","","cri","de","ce","que","ça","donne","","inscription","comme","tu","parles","en","anglais","anglais-français","","non","parce","que","j'ai","pas","","après","je","sais","que","le","loup","tia","c'est","ouf","et","il","a","des","possibilités","de","reconnaître","des","types","de","voix","","et","tu","peux","lui","dire","","voilà","tu","vois","on","sait","jamais","exact","","parce","que","personne","ne","va","voir","le","panneau","de","captation","tu","as","juste","l'affichage","et","vu","que","la","session","j'ai","tellement","bordélique","","ça","dépend","ça","dépend","ce","que","tu","m'as","dit","en","fait","sympa","","Élysées","des","constellations","de","mots","c'est","cool","mais","c'est","pour","ça","que","","que","j'ai","tout","de","suite","dit","que","tout","ce","qui","est","constellation","ça","peut","tourner","atelier","parce","que","c'est","pas","le","but","de","cet","objet","","et","pour","le","coup","ça","c'est","vraiment","une","heure","qui","pourra","figurer","dans","mon","portfolio","","ben","oui","c'est","ce","que","je","puisse","faire","des","trucs","aussi","","c'est","vrai","ça","veut","dire","j'aurais","jamais","eu","l'idée","de","faire","ça","","qu'est-ce","qui","arrive","et","oui","c'est","vrai","","d'abord","l'idée","j'en","ai","parlé","avec","toi","dans","le","bain","pour","savoir","ce","qui","était","un","peu","près","","et","après","samedi","et","ensuite","je","l'ai","exposé","à","Laurine","elle","était","chaude","une","fois","que","j'en","ai","parlé","à","Laurine","j'ai","écrit","une","fiche","projet","","éteins","la","démo","pour","","prendre","une","capture","d'écran","","Windows","j'ai","ça","fait","quoi","chez","toi","","le","truc","de","gamer","","je","peux","pas","cliquer","sur","","l'émission","un","nouveau","Windows","Explorer","sur","des","programmes","qui","sont","comme","des","trucs","qui","n'ont","rien","à","voir","avec","Windows","","je","l'ai","fait","sur","Unity","tu","vois","","j'ai","fait","sur","Chrome","","juste","ça","","déjà","tu","as","vu","on","parle","un","tout","petit","peu","comme","ça","","est-ce","qu'on","prépare","même","en","cycle","ou","en","mode","tu","fais","une","liste","de","mots","","j'ai","vu","dans","la","démo","que","tu","montrais","y","avait","des","choses","au","début","parler","avec","peu","de","mots","","très","particulier","ça","vous","n'êtes","pas","sur","lui","","mais","il","y","a","eu","un","passage","entre","ce","mouvement","avec","des","trucs","en","8","","c'était","juste","un","cercle","en","fait","je","savais","pas","encore","j'ai","pas","encore","fait","ça","j'ai","juste","faire","un","cercle","pas","encore","réparti","sur","la","taille","","le","son","","et","c'est","marrant","parce","que","le","gars","il","va","plus","vite","qu'avant","parce","que","il","y","a","des","mots","plus","ça","va","vite","en","fait","","en","fait","","pourquoi","ça","fait","ça","","parce","que","ils","ont","tous","en","random","","en","plus","dans","leur","vitesse","ils","avancent","tous","dans","random","quand","ils","sont","créés","on","l'aura","tribunal","et","au","hasard","en","disant","ça","c'est","ta","vitesse","","mais","vu","que","cette","vitesse","ça","reste","des","entiers","","bah","en","fait","c'est","tu","as","plus","des","étapes","de","vitesse","donc","elle","est","maman","il","s'aligne","plus","de","la","formule","utilisée","je","peux","pas","dire","plus","précis","mais","en","gros","","ils","vont","plus","vite","à","cause","d'un","au","hasard","et","vu","que","il","y","en","a","plein","tu","commences","à","avoir","un","peu","de","toutes","les","vitesses","faut","que","je","trouve","la","salutation","pour","faire","ça","en","continu","toi","qui","écoute","derrière","après","c'est","le","truc","qui","va","comme","ça","en","est","","les","variables","du","coup","c'est","ça","est-ce","que","c'est","une","variable","et","la","forme","","ouais","c'est","variable","de","comptage","je","le","ferai","pas","le","faire","là","maintenant","","ouais","c'est","sûr","","président","de","la","République","française","","qu'il","a","loupé","des","fois","","on","a","pas","encore","tous","les","mots","amélioration","de","la","reconnaissance","","mais","moi","aussi","bien","mettre","une","animation","qui","fait","que","les","mots","ils","arrivent","les","uns","après","les","autres","ils","apparaissent","pas","comme","ça","parce","que","c'est","marrant","","trou","noir","","interdisciplinaire","ce","colloque","sera","interdisciplinaire","","du","coup","est-ce","que","interdisciplinaires","il","va","apparaître","plusieurs","fois","si","je","vais","vous","plusieurs","fois","","discipline","satellitaire","données","data","","donner","doudou","doudou","","donnez-moi","de","la","data","de","la","data","je","sais","pourquoi","","plus","","merci","","oh","mais","ça","veut","dire","qu'au","bout","d'un","moment","de","la","journée","ça","va","être","je","pense","que","j'ai","oublié","un","truc","du","coup","","est-ce","qu'on","laisse","tourner","toute","la","journée","pour","voir","ce","que","ça","fait","tout","seul","","non","mais","je","pense","qu'on","fera","dans","la","semaine","","je","comptais","vraiment","pas","faire","du","tout","à","l'heure","","en","plus","je","regarde","plus","je","m'enfonce","plus","d'argent","c'est","la","3D","du","coup","","tu","estimes","à","combien","de","temps","de","préparation","pour","ce","visuel","","vous","arrivez","à","la","où","on","en","est","où","pour","le","final","dialogue","reconnaître","","truc","interdiscipline","il","me","l'a","pas","choper","","si","lui","il","est","pas","là","dedans","du","coup","","ok","il","est","pas","si","loin","pourtant","il","est","grand","","interdisciplinaire","","il","est","parti","sur","vu","qu'il","était","chaude","","il","y","a","il","y","a","le","mot","horloge","","ouais","ben","on","l'a","pas","dit","horloge","","dis-moi","par","discipline","","constellation","","et","tous","ceux","qui","sont","au","niveau","du","HTML","tu","vois","à","quoi","ça","ressemble","","juste","une","liste","de","mots","comme","ça","tout","les","temps","","et","tout","ça","c'est","stocker","la","même","endroit","donc","visuel","là","il","sera","pas","peur","du","nom","et","on","peut","le","faire","rejouer","","qu'est-ce","que","je","note","certifié","","musique","Judy","pas","de","liste","de","bosse","alors","prends","prends","","ils","vont","créer","une","nouvelle","fille","déjà","une","il","le","fait","après","je","dois","écrire","le","truc","là","","rejoue","ce","visuel","il","y","a","pas","de","truc","marqué","","personne","comme","ça","déjà","","si","tu","arrives","à","me","dire"]
