import styled from 'styled-components';
 
const Loader = () => {
   
  return (
    <StyledWrapper>
      <div className="loader">
        <svg viewBox="0 0 100 100" height="100px" width="100px">
          <defs>
            <linearGradient y2="0%" x2="100%" y1="0%" x1="0%" id="gradient1">
              <stop stopColor="#4fc5f7" offset="0%" />
              <stop stopColor="#63cc86" offset="50%" />
              <stop stopColor="#76e092" offset="100%" />
            </linearGradient>
            <linearGradient y2="0%" x2="100%" y1="0%" x1="0%" id="gradient2">
              <stop stopColor="#b5c8cdbd" offset="0%" />
              <stop stopColor="#b6dec9" offset="50%" />
              <stop stopColor="#decfb6" offset="100%" />
            </linearGradient>
          </defs>
          <circle stroke="url(#gradient1)" r={40} cy={50} cx={50} className="loader-circle circle-1" />
          <circle stroke="url(#gradient2)" r={30} cy={50} cx={50} className="loader-circle circle-2" />
        </svg>
      </div>
    </StyledWrapper>
  );
}
 
const StyledWrapper = styled.div`
  .loader {
    display: inline-block;
    width: 100px;
    height: 100px;
    position: relative;
  }
 
  .loader svg {
    width: 100%;
    height: 100%;
    animation: rotate-svg 2s linear infinite;
    transform-origin: center center;
  }
 
  .loader-circle {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
  }
 
  .circle-1 {
    stroke-dasharray: 251.3274; /* 2 * π * 40 */
    stroke-dashoffset: 251.3274;
    animation: dash-circle1 1.5s cubic-bezier(0.66, 0, 0.34, 1) infinite alternate;
  }
 
  .circle-2 {
    stroke-dasharray: 188.4956; /* 2 * π * 30 */
    stroke-dashoffset: 0;
    animation: dash-circle2 1.5s cubic-bezier(0.66, 0, 0.34, 1) infinite alternate;
  }
 
  @keyframes rotate-svg {
    100% {
      transform: rotate(360deg);
    }
  }
 
  @keyframes dash-circle1 {
    0% {
      stroke-dashoffset: 251.3274;
    }
    100% {
      stroke-dashoffset: 0;
    }
  }
 
  @keyframes dash-circle2 {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: 188.4956;
    }
  }`;
 
export default Loader;
 
 