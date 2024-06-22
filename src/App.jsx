import { createSignal, createEffect  } from 'solid-js';
import 'bootstrap/dist/css/bootstrap.min.css';

const BtnCopy = (props) => {
  const [copySuccess, setCopySuccess] = createSignal(false);
  const [showPopup, setShowPopup] = createSignal(false);

  createEffect(() => {
    if (copySuccess()) {
      setShowPopup(true);
      const timer = setTimeout(() => {
        setShowPopup(false);
        setCopySuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  });

  /*const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(props.content);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };*/
  const copyToClipboard = () => {
    const textArea = document.getElementById('content-to-copy');
    textArea.disabled = false;
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      textArea.setSelectionRange(0, 0); 
      textArea.disabled = true
      setCopySuccess(successful);
    } catch (err) {
      console.error('Failed to copy: ', err);
      textArea.setSelectionRange(0, 0); 
      textArea.disabled = true;
      setCopySuccess(false);
    }
  };

  return (
     <div class="position-relative">
      <button 
        class={`btn ${copySuccess() ? 'btn-success' : 'btn-outline-primary'} ms-2`}
        style="box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease;"
        onClick={copyToClipboard} title="Copy to clipboard">
        {copySuccess() ? (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        ) : (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
          </svg>
        )}
      </button>
      {showPopup() && (
        <div class="position-absolute bg-success text-white px-2 py-1 rounded" style="top: -50px; left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 1000;">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
};

function App() {
  const [input, setInput] = createSignal('');
  const [paperInfo, setPaperInfo] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal(null);

  const exampleDOI = 'doi:10.1016/j.neuron.2019.05.013';
  const examplePMID = '31174959';

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      fetchPaperInfo();
    }
  };

  const shortenAuthorList = (authors) => {
    const authorList = authors.split('; ');
    if (authorList.length <= 2) {
      return authors;
    } else {
      return `${authorList.slice(0, 2).join('; ')} et al.`;
    }
  };

  const getCassetteContent = (info) => {
    return `${info.shortAuthors}|${info.title}|${info.journal}|doi:${info.doi}|PMID:${info.pmid}`;
  };

  const copyToClipboard = async () => {
    const content = getCassetteContent(paperInfo());
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const fetchPaperInfo = async () => {
    setIsLoading(true);
    setError(null);
    setPaperInfo(null);

    const inputValue = input().trim();
    let id, idType;

    if (inputValue.toLowerCase().startsWith('doi:') || inputValue.startsWith('10.')) {
      id = inputValue.toLowerCase().startsWith('doi:') ? inputValue.slice(4) : inputValue;
      idType = 'doi';
    } else if (/^\d+$/.test(inputValue) || /^(pmid|pm|pubmed):/i.test(inputValue)) {
      id = inputValue.replace(/^(pmid|pm|pubmed):/i, '');
      idType = 'pmid';
    } else {
      setError('Invalid input. Please enter a valid DOI or PMID.');
      setIsLoading(false);
      return;
    }

    try {
      let data;
      if (idType === 'pmid') {
        data = await fetchFromPubMed(id);
      } else {
        data = await fetchFromPubMed(id, 'doi');
        if (!data) {
          data = await fetchFromCrossRef(id);
        }
      }

      if (!data) {
        throw new Error('No information found for the given input.');
      }

      data.shortAuthors = shortenAuthorList(data.authors);
      setPaperInfo(data);
    } catch (err) {
      setError(err.message);
    }

    setIsLoading(false);
  };

  const fetchFromPubMed = async (id, idType = 'pmid') => {
    const searchTerm = idType === 'pmid' ? id : `${id}[doi]`;
    const searchResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmode=json`, {
      //headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
    });
    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult.idlist[0];

    if (!pmid) return null;

    const summaryResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`, {
      //headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
    });
    const summaryData = await summaryResponse.json();
    const article = summaryData.result[pmid];

    return {
      authors: article.authors.map(a => `${a.name}`).join('; '),
      title: article.title,
      journal: `${article.fulljournalname}. ${article.pubdate};${article.volume}(${article.issue}):${article.pages}`,
      doi: article.elocationid ? article.elocationid.replace('doi: ', '') : 'N/A',
      pmid: pmid
    };
  };

  const fetchFromCrossRef = async (doi) => {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      //headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const item = data.message;

    return {
      authors: item.author ? item.author.map(a => `${a.family}, ${a.given}`).join('; ') : 'N/A',
      title: item.title ? item.title[0] : 'N/A',
      journal: item['container-title'] ? `${item['container-title'][0]}. ${item.issued['date-parts'][0][0]};${item.volume}(${item.issue}):${item.page}` : 'N/A',
      doi: item.DOI,
      pmid: 'N/A'
    };
  };

  return (
    <div class="container mt-5">
      <h1 class="mb-4">PubMed Lookup</h1>
      <p class="mb-2">
        <span class="me-3">Example DOI: <code class="text-muted">{exampleDOI}</code></span>
        <span>Example PMID: <code class="text-muted">{examplePMID}</code></span>
      </p>
      <div class="input-group mb-3">
        <input 
          type="text" 
          class="form-control" 
          placeholder="Enter DOI or PMID" 
          value={input()} 
          onInput={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button class="btn btn-primary" onClick={fetchPaperInfo} disabled={isLoading()}>
          {isLoading() ? 'Loading...' : 'Submit'}
        </button>
      </div>
      {error() && <div class="alert alert-danger">{error()}</div>}
      {paperInfo() && (
        <div class="card">
          <div class="card-body">
            <p><strong>Authors:</strong> <span class="user-select-all">{paperInfo().authors}</span></p>
            <p><strong>Auth.:</strong> <span class="user-select-all">{paperInfo().shortAuthors}</span></p>
            <p><strong>Title:</strong> <span class="user-select-all">{paperInfo().title}</span></p>
            <p><strong>Journal entry:</strong> <span class="user-select-all">{paperInfo().journal}</span></p>
            <p><strong>DOI:</strong> <a href={`https://doi.org/${paperInfo().doi}`} target="_blank" rel="noopener noreferrer" class="user-select-all">{paperInfo().doi}</a></p>
            <p><strong>PMID:</strong> <a href={`https://pubmed.ncbi.nlm.nih.gov/${paperInfo().pmid}`} target="_blank" rel="noopener noreferrer" class="user-select-all">{paperInfo().pmid}</a></p>
            <div class="mt-3 d-flex align-items-center">
              <textarea 
                id="content-to-copy"
                class="form-control flex-grow-1 bg-light"
                style="font-size: 0.9em; resize: none; overflow: hidden;"
                rows="3" readOnly disabled value={getCassetteContent(paperInfo())}
              />
              <BtnCopy />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
