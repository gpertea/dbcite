import { createSignal } from 'solid-js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

function App() {
  const [input, setInput] = createSignal('');
  const [paperInfo, setPaperInfo] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [copySuccess, setCopySuccess] = createSignal(false);

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
      headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
    });
    const searchData = await searchResponse.json();
    const pmid = searchData.esearchresult.idlist[0];

    if (!pmid) return null;

    const summaryResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`, {
      headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
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
      headers: { 'User-Agent': 'PubMedLookupApp/1.0 (mailto:your-email@example.com)' }
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
              <div class="flex-grow-1 bg-light p-2 rounded user-select-all" style="font-size: 0.9em;">
                {getCassetteContent(paperInfo())}
              </div>
              <button class="btn btn-outline-secondary ms-2" onClick={copyToClipboard} title="Copy to clipboard">
                <i class={`bi ${copySuccess() ? 'bi-check' : 'bi-clipboard'}`}></i>
              </button>
            </div>
            {copySuccess() && <div class="text-success mt-2">Copied to clipboard!</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
